const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Allocation = require('../../models/Allocation');
const Expenditure = require('../../models/Expenditure');
const Department = require('../../models/Department');
const BudgetHead = require('../../models/BudgetHead');
const User = require('../../models/User');
const Settings = require('../../models/Settings');

describe('CBMS Acceptance Criteria Tests', () => {
    let authToken;
    let officeToken;
    let departmentUser;
    let officeUser;
    let department;
    let budgetHead;
    let allocation;

    beforeAll(async () => {
        // Connect to test database
        await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/cbms_test');

        // Create test department
        department = await Department.create({
            name: 'Test Department A',
            code: 'DEPT-A',
            hodName: 'Test HOD',
            hodEmail: 'hod@test.com'
        });

        // Create test budget head
        budgetHead = await BudgetHead.create({
            name: 'Test Budget Head X',
            code: 'BH-X',
            category: 'operational'
        });

        // Create department user
        departmentUser = await User.create({
            name: 'Department User',
            email: 'dept@test.com',
            password: 'password123',
            role: 'department',
            department: department._id
        });

        // Create office user
        officeUser = await User.create({
            name: 'Office User',
            email: 'office@test.com',
            password: 'password123',
            role: 'office'
        });

        // Login to get tokens
        const deptLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'dept@test.com', password: 'password123' });
        authToken = deptLogin.body.token;

        const officeLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'office@test.com', password: 'password123' });
        officeToken = officeLogin.body.token;

        // Set default settings
        await Settings.create([
            { key: 'budget_overspend_policy', value: 'disallow', category: 'system' },
            { key: 'attachment_required_threshold', value: 10000, category: 'system' },
            { key: 'attachment_policy', value: 'warn', category: 'system' }
        ]);
    });

    afterAll(async () => {
        // Cleanup
        await Allocation.deleteMany({});
        await Expenditure.deleteMany({});
        await Department.deleteMany({});
        await BudgetHead.deleteMany({});
        await User.deleteMany({});
        await Settings.deleteMany({});
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Clear expenditures before each test
        await Expenditure.deleteMany({});
        await Allocation.deleteMany({});
    });

    /**
     * TEST CASE 1: Allocation Correctness
     * When Office adds allocation ₹100,000 for Dept A head X,
     * remaining_amount initially equals ₹100,000.
     */
    describe('Test Case 1: Allocation Correctness', () => {
        it('should create allocation with correct initial values', async () => {
            // Create allocation
            const response = await request(app)
                .post('/api/allocations')
                .set('Authorization', `Bearer ${officeToken}`)
                .send({
                    department: department._id,
                    budgetHead: budgetHead._id,
                    allocatedAmount: 100000,
                    financialYear: '2024-2025',
                    remarks: 'Test allocation'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            allocation = response.body.data.allocation;

            // Verify allocation values
            expect(allocation.allocatedAmount).toBe(100000);
            expect(allocation.spentAmount).toBe(0);
            expect(allocation.remainingAmount).toBe(100000);

            // GET allocation to verify
            const getResponse = await request(app)
                .get(`/api/allocations/${allocation._id}`)
                .set('Authorization', `Bearer ${officeToken}`);

            expect(getResponse.status).toBe(200);
            expect(getResponse.body.data.allocation.allocatedAmount).toBe(100000);
            expect(getResponse.body.data.allocation.spentAmount).toBe(0);
            expect(getResponse.body.data.allocation.remainingAmount).toBe(100000);
        });
    });

    /**
     * TEST CASE 2: Submission & Approval
     * Dept submits ₹10,000; Office approves → allocation.spent increases to ₹10,000
     * and remaining=₹90,000. Approval action must be atomic and appear in audit_logs.
     */
    describe('Test Case 2: Submission & Approval Atomicity', () => {
        beforeEach(async () => {
            // Create allocation
            allocation = await Allocation.create({
                department: department._id,
                budgetHead: budgetHead._id,
                allocatedAmount: 100000,
                financialYear: '2024-2025',
                createdBy: officeUser._id
            });
        });

        it('should update allocation atomically on approval', async () => {
            // Submit expenditure
            const submitResponse = await request(app)
                .post('/api/expenditures')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    budgetHead: budgetHead._id,
                    billNumber: 'BILL-001',
                    billDate: '2024-06-15',
                    billAmount: 10000,
                    partyName: 'Test Vendor',
                    expenseDetails: 'Test expense',
                    attachments: []
                });

            expect(submitResponse.status).toBe(201);
            const expenditureId = submitResponse.body.data.expenditure._id;

            // Approve expenditure
            const approveResponse = await request(app)
                .put(`/api/expenditures/${expenditureId}/approve`)
                .set('Authorization', `Bearer ${officeToken}`)
                .send({ remarks: 'Approved' });

            expect(approveResponse.status).toBe(200);
            expect(approveResponse.body.success).toBe(true);

            // Verify allocation updated
            const updatedAllocation = await Allocation.findById(allocation._id);
            expect(updatedAllocation.spentAmount).toBe(10000);
            expect(updatedAllocation.remainingAmount).toBe(90000);

            // Verify audit log exists
            const AuditLog = require('../../models/AuditLog');
            const auditLog = await AuditLog.findOne({
                eventType: 'expenditure_approved',
                targetId: expenditureId
            });
            expect(auditLog).toBeTruthy();
            expect(auditLog.details.billAmount).toBe(10000);
        });
    });

    /**
     * TEST CASE 3: Rejection No-Change
     * Dept submits ₹5,000; Office rejects → allocation.spent unchanged.
     */
    describe('Test Case 3: Rejection No-Change', () => {
        beforeEach(async () => {
            allocation = await Allocation.create({
                department: department._id,
                budgetHead: budgetHead._id,
                allocatedAmount: 100000,
                spentAmount: 10000,
                financialYear: '2024-2025',
                createdBy: officeUser._id
            });
        });

        it('should not change spent amount on rejection', async () => {
            const initialSpent = allocation.spentAmount;

            // Submit expenditure
            const submitResponse = await request(app)
                .post('/api/expenditures')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    budgetHead: budgetHead._id,
                    billNumber: 'BILL-002',
                    billDate: '2024-06-15',
                    billAmount: 5000,
                    partyName: 'Test Vendor',
                    expenseDetails: 'Test expense',
                    attachments: []
                });

            const expenditureId = submitResponse.body.data.expenditure._id;

            // Reject expenditure
            const rejectResponse = await request(app)
                .put(`/api/expenditures/${expenditureId}/reject`)
                .set('Authorization', `Bearer ${officeToken}`)
                .send({ remarks: 'Rejected for testing' });

            expect(rejectResponse.status).toBe(200);

            // Verify spent amount unchanged
            const updatedAllocation = await Allocation.findById(allocation._id);
            expect(updatedAllocation.spentAmount).toBe(initialSpent);
            expect(updatedAllocation.spentAmount).toBe(10000);
        });
    });

    /**
     * TEST CASE 4: Overspend Prevention
     * Dept tries to submit ₹200,000 when remaining is ₹50,000.
     * System blocks per configuration.
     */
    describe('Test Case 4: Overspend Prevention', () => {
        beforeEach(async () => {
            allocation = await Allocation.create({
                department: department._id,
                budgetHead: budgetHead._id,
                allocatedAmount: 100000,
                spentAmount: 50000,
                financialYear: '2024-2025',
                createdBy: officeUser._id
            });

            // Ensure overspend policy is set to disallow
            await Settings.findOneAndUpdate(
                { key: 'budget_overspend_policy' },
                { value: 'disallow' },
                { upsert: true }
            );
        });

        it('should block submission when exceeding remaining budget', async () => {
            const submitResponse = await request(app)
                .post('/api/expenditures')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    budgetHead: budgetHead._id,
                    billNumber: 'BILL-003',
                    billDate: '2024-06-15',
                    billAmount: 200000,
                    partyName: 'Test Vendor',
                    expenseDetails: 'Overspend test',
                    attachments: []
                });

            expect(submitResponse.status).toBe(400);
            expect(submitResponse.body.success).toBe(false);
            expect(submitResponse.body.message).toContain('exceeds remaining budget');
            expect(submitResponse.body.remainingBudget).toBe(50000);
        });
    });

    /**
     * TEST CASE 5: Year-over-Year Comparison
     * Admin uploads last-year allocations & expenditures;
     * dashboard shows year-over-year comparison figures.
     */
    describe('Test Case 5: Year-over-Year Comparison', () => {
        beforeEach(async () => {
            // Create allocations for 2023-2024
            await Allocation.create({
                department: department._id,
                budgetHead: budgetHead._id,
                allocatedAmount: 80000,
                spentAmount: 60000,
                financialYear: '2023-2024',
                createdBy: officeUser._id
            });

            // Create allocations for 2024-2025
            await Allocation.create({
                department: department._id,
                budgetHead: budgetHead._id,
                allocatedAmount: 100000,
                spentAmount: 70000,
                financialYear: '2024-2025',
                createdBy: officeUser._id
            });
        });

        it('should return year-over-year comparison data', async () => {
            const response = await request(app)
                .get('/api/allocations/year-comparison')
                .query({
                    currentYear: '2024-2025',
                    previousYear: '2023-2024'
                })
                .set('Authorization', `Bearer ${officeToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const data = response.body.data;
            expect(data.overallComparison).toBeDefined();
            expect(data.departmentComparison).toBeDefined();
            expect(data.budgetHeadComparison).toBeDefined();

            // Verify allocation change
            expect(data.overallComparison.allocationChange.current).toBe(100000);
            expect(data.overallComparison.allocationChange.previous).toBe(80000);
            expect(data.overallComparison.allocationChange.change).toBe(20000);
        });
    });

    /**
     * TEST CASE 6: Attachments Required
     * Attempt to approve an expenditure without required proof triggers warning.
     */
    describe('Test Case 6: Attachment Requirements', () => {
        beforeEach(async () => {
            allocation = await Allocation.create({
                department: department._id,
                budgetHead: budgetHead._id,
                allocatedAmount: 100000,
                financialYear: '2024-2025',
                createdBy: officeUser._id
            });

            // Set attachment policy to block
            await Settings.findOneAndUpdate(
                { key: 'attachment_policy' },
                { value: 'block' },
                { upsert: true }
            );

            await Settings.findOneAndUpdate(
                { key: 'attachment_required_threshold' },
                { value: 10000 },
                { upsert: true }
            );
        });

        it('should block submission without attachments when amount exceeds threshold', async () => {
            const submitResponse = await request(app)
                .post('/api/expenditures')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    budgetHead: budgetHead._id,
                    billNumber: 'BILL-004',
                    billDate: '2024-06-15',
                    billAmount: 15000,
                    partyName: 'Test Vendor',
                    expenseDetails: 'Test expense',
                    attachments: []
                });

            expect(submitResponse.status).toBe(400);
            expect(submitResponse.body.code).toBe('ATTACHMENTS_REQUIRED');
            expect(submitResponse.body.message).toContain('Attachments are required');
        });

        it('should allow submission with attachments', async () => {
            const submitResponse = await request(app)
                .post('/api/expenditures')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    budgetHead: budgetHead._id,
                    billNumber: 'BILL-005',
                    billDate: '2024-06-15',
                    billAmount: 15000,
                    partyName: 'Test Vendor',
                    expenseDetails: 'Test expense',
                    attachments: [{
                        filename: 'invoice.pdf',
                        originalName: 'invoice.pdf',
                        mimetype: 'application/pdf',
                        size: 1024,
                        url: '/uploads/invoice.pdf'
                    }]
                });

            expect(submitResponse.status).toBe(201);
            expect(submitResponse.body.success).toBe(true);
        });
    });

    /**
     * TEST CASE 7: Concurrency Control
     * Two approvals processed concurrently for same allocation
     * do not allow spent to exceed allocated.
     */
    describe('Test Case 7: Concurrency Control', () => {
        beforeEach(async () => {
            allocation = await Allocation.create({
                department: department._id,
                budgetHead: budgetHead._id,
                allocatedAmount: 100000,
                financialYear: '2024-2025',
                createdBy: officeUser._id
            });
        });

        it('should prevent concurrent approvals from exceeding budget', async () => {
            // Create two expenditures
            const exp1Response = await request(app)
                .post('/api/expenditures')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    budgetHead: budgetHead._id,
                    billNumber: 'BILL-CONC-1',
                    billDate: '2024-06-15',
                    billAmount: 60000,
                    partyName: 'Vendor 1',
                    expenseDetails: 'Concurrent test 1',
                    attachments: []
                });

            const exp2Response = await request(app)
                .post('/api/expenditures')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    budgetHead: budgetHead._id,
                    billNumber: 'BILL-CONC-2',
                    billDate: '2024-06-15',
                    billAmount: 60000,
                    partyName: 'Vendor 2',
                    expenseDetails: 'Concurrent test 2',
                    attachments: []
                });

            const exp1Id = exp1Response.body.data.expenditure._id;
            const exp2Id = exp2Response.body.data.expenditure._id;

            // Approve both concurrently
            const approvalPromises = [
                request(app)
                    .put(`/api/expenditures/${exp1Id}/approve`)
                    .set('Authorization', `Bearer ${officeToken}`)
                    .send({ remarks: 'Concurrent approval 1' }),
                request(app)
                    .put(`/api/expenditures/${exp2Id}/approve`)
                    .set('Authorization', `Bearer ${officeToken}`)
                    .send({ remarks: 'Concurrent approval 2' })
            ];

            const results = await Promise.all(approvalPromises);

            // One should succeed, one should fail
            const successCount = results.filter(r => r.status === 200).length;
            const failureCount = results.filter(r => r.status === 400).length;

            expect(successCount).toBe(1);
            expect(failureCount).toBe(1);

            // Verify allocation spent amount doesn't exceed allocated
            const finalAllocation = await Allocation.findById(allocation._id);
            expect(finalAllocation.spentAmount).toBeLessThanOrEqual(finalAllocation.allocatedAmount);
            expect(finalAllocation.spentAmount).toBe(60000);
        });
    });
});
