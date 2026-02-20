const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const BASE_URL = 'http://localhost:5000/api';

// Mocks or Helpers
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTest() {
    try {
        console.log('--- Starting Strict Expenditure Workflow Verification ---');

        // 0. Database Setup (Get a valid BudgetHead and Allocation)
        console.log('[0] Connecting to DB to setup prerequisites...');
        await mongoose.connect(process.env.MONGODB_URI);

        const Department = mongoose.model('Department', new mongoose.Schema({}));
        const BudgetHead = mongoose.model('BudgetHead', new mongoose.Schema({}));
        const Allocation = mongoose.model('Allocation', new mongoose.Schema({}));

        // Find AIDS Dept
        const aidsDept = await Department.findOne({ code: 'AIDS' });
        if (!aidsDept) throw new Error('AIDS Department not found');
        const deptId = aidsDept._id.toString();

        // Find a Budget Head (e.g., Consumables or similar)
        const budgetHead = await BudgetHead.findOne();
        if (!budgetHead) throw new Error('No Budget Head found');
        const budgetHeadId = budgetHead._id.toString();

        // Ensure Allocation Exists for this year
        const financialYear = '2025-2026';
        let allocation = await Allocation.findOne({
            department: deptId,
            budgetHead: budgetHeadId,
            financialYear
        });

        if (!allocation) {
            console.log('Creating prerequisite allocation...');
            const User = mongoose.model('User', new mongoose.Schema({}));
            const admin = await User.findOne({ role: 'admin' });

            await Allocation.create({
                department: deptId,
                budgetHead: budgetHeadId,
                financialYear,
                allocatedAmount: 100000,
                spentAmount: 0,
                remarks: 'Test Allocation',
                status: 'active',
                createdBy: admin._id
            });
            console.log('Allocation created.');
        } else {
            console.log('Allocation exists.');
        }
        await mongoose.connection.close();

        // 1. Logins
        console.log('\n[1] Performing Logins...');

        const login = async (email, password, role) => {
            try {
                const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
                console.log(`Logged in as ${role}`);
                return {
                    token: res.data.data.token,
                    headers: { Authorization: `Bearer ${res.data.data.token}` },
                    user: res.data.data.user
                };
            } catch (e) {
                console.error(`Login failed for ${role}:`, e.message);
                throw e;
            }
        };

        const deptUser = await login('coordinator_aids@bms.com', 'password123', 'Department');
        const hodUser = await login('hod.aids@bms.com', 'password123', 'HOD');
        const principalUser = await login('principal@bms.com', 'password123', 'Principal');
        const officeUser = await login('office@bms.com', 'office123', 'Office');

        // 2. Submit Expenditure
        console.log('\n[2] Submitting Expenditure (Dept)...');
        const billNumber = `TEST-${Date.now()}`;
        const submitRes = await axios.post(`${BASE_URL}/expenditures`, {
            budgetHead: budgetHeadId,
            billNumber,
            billDate: new Date().toISOString(),
            billAmount: 5000,
            partyName: 'Test Vendor',
            expenseDetails: 'Test Expense for Verification'
        }, { headers: deptUser.headers });

        const expId = submitRes.data.data.expenditure._id;
        console.log(`Expenditure Submitted: ${expId} [Status: ${submitRes.data.data.expenditure.status}]`);

        // 3. Negative Test: Office tries to Approve (Should Fail - Not Verified)
        console.log('\n[3] Negative Test: Office tries to Approve Pending Item...');
        try {
            await axios.put(`${BASE_URL}/expenditures/${expId}/approve`, {
                remarks: 'Office trying to bypass'
            }, { headers: officeUser.headers });
            console.error('❌ FAIL: Office should NOT be able to approve pending item.');
        } catch (e) {
            console.log(`✅ SUCCESS: Office blocked. (${e.response?.data?.message})`);
        }

        // 4. Negative Test: Principal tries to Approve (Should Fail - Not Verified)
        console.log('\n[4] Negative Test: Principal tries to Approve Pending Item...');
        try {
            await axios.put(`${BASE_URL}/expenditures/${expId}/approve`, {
                remarks: 'Principal trying to bypass verification'
            }, { headers: principalUser.headers });
            console.error('❌ FAIL: Principal should NOT be able to approve pending item.');
        } catch (e) {
            // Expect 400 because status != verified
            console.log(`✅ SUCCESS: Principal blocked. (${e.response?.data?.message})`);
        }

        // 5. HOD Verifies
        console.log('\n[5] HOD Verifies...');
        const verifyRes = await axios.put(`${BASE_URL}/expenditures/${expId}/verify`, {
            remarks: 'Verified by HOD'
        }, { headers: hodUser.headers });
        console.log(`Expenditure Verified. [Status: ${verifyRes.data.data.expenditure.status}]`);

        // 6. Negative Test: Office tries to Approve (Should Fail - Restricted Role)
        console.log('\n[6] Negative Test: Office tries to Approve Verified Item...');
        try {
            await axios.put(`${BASE_URL}/expenditures/${expId}/approve`, {
                remarks: 'Office trying to approve'
            }, { headers: officeUser.headers });
            console.error('❌ FAIL: Office should NOT be able to approve (Restricted to Principal/VP).');
        } catch (e) {
            // Expect 403
            console.log(`✅ SUCCESS: Office blocked. (${e.response?.data?.message})`);
        }

        // 7. Principal Approves
        console.log('\n[7] Principal Approves...');
        const approveRes = await axios.put(`${BASE_URL}/expenditures/${expId}/approve`, {
            remarks: 'Approved by Principal'
        }, { headers: principalUser.headers });
        console.log(`Expenditure Approved. [Status: ${approveRes.data.data.expenditure.status}]`);

        // 8. Office Finalizes
        console.log('\n[8] Office Finalizes...');
        const finalizeRes = await axios.put(`${BASE_URL}/expenditures/${expId}/finalize`, {
            remarks: 'Sanctioned by Office'
        }, { headers: officeUser.headers });
        console.log(`Expenditure Finalized. [Status: ${finalizeRes.data.data.expenditure.status}]`);

        console.log('\n--- Verification Complete ---');

    } catch (err) {
        console.error('❌ GLOBAL TEST FAILURE:', err.message);
        if (err.response) {
            console.error('Response Data:', err.response.data);
        }
    }
}

runTest();
