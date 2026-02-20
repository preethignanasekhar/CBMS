const axios = require('./node_modules/axios');
const mongoose = require('./node_modules/mongoose');
require('./node_modules/dotenv').config({ path: './.env' });

const BASE_URL = 'http://localhost:5000/api';

async function testWorkflow() {
    try {
        console.log('--- Starting New Workflow Verification ---');

        console.log('[0] Connecting to DB to fetch valid BudgetHead ID...');
        await mongoose.connect(process.env.MONGODB_URI);
        const BudgetHead = mongoose.model('BudgetHead', new mongoose.Schema({}));
        const bh = await BudgetHead.findOne();
        if (!bh) throw new Error('No budget heads found in DB');
        const budgetHeadId = bh._id.toString();
        console.log(`Found BudgetHead ID: ${budgetHeadId}`);
        await mongoose.connection.close();

        // 1. Login as Department Coordinator (AIDS)
        console.log('\n[1] Logging in as Department Coordinator...');
        const coordLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'coordinator_aids@bms.com',
            password: 'password123'
        });
        const coordToken = coordLogin.data.data.token;
        const coordHeaders = { Authorization: `Bearer ${coordToken}` };
        const deptId = coordLogin.data.data.user.department;

        // 2. Create and Submit a Budget Proposal
        console.log(`[2] Creating Budget Proposal for Dept: ${deptId}...`);
        const proposalRes = await axios.post(`${BASE_URL}/budget-proposals`, {
            financialYear: '2025-2026',
            department: deptId,
            proposalItems: [
                {
                    budgetHead: budgetHeadId,
                    proposedAmount: 50000,
                    justification: 'Test Verification'
                }
            ],
            notes: 'Test Workflow Proposal',
            status: 'submitted'
        }, { headers: coordHeaders });

        const proposalId = proposalRes.data.data.proposal._id;
        console.log(`Proposal created and submitted: ${proposalId}, Status: ${proposalRes.data.data.proposal.status}`);

        // 3. Login as HOD (AIDS)
        console.log('\n[3] Logging in as HOD...');
        const hodLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'hod.aids@bms.com',
            password: 'password123'
        });
        const hodHeaders = { Authorization: `Bearer ${hodLogin.data.data.token}` };

        // 4. HOD Verifies
        console.log('[4] HOD Verifying...');
        const hodVerify = await axios.put(`${BASE_URL}/budget-proposals/${proposalId}/verify`, {
            remarks: 'Verified by HOD'
        }, { headers: hodHeaders });
        console.log(`HOD Verify success. Status: ${hodVerify.data.data.proposal.status}`);

        // 5. Login as Principal
        console.log('\n[5] Logging in as Principal...');
        const principalLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'principal@bms.com',
            password: 'password123'
        });
        const principalHeaders = { Authorization: `Bearer ${principalLogin.data.data.token}` };

        // 6. Principal Tries to Approve (SHOULD FAIL)
        console.log('[6] Principal trying to Approve (expecting failure)...');
        try {
            await axios.put(`${BASE_URL}/budget-proposals/${proposalId}/approve`, {
                notes: 'Principal trying to approve'
            }, { headers: principalHeaders });
            console.error('ERROR: Principal was able to approve!');
        } catch (err) {
            console.log(`Success: Principal blocked from approve. Error: ${err.response?.data?.message}`);
        }

        // 7. Principal Verifies
        console.log('[7] Principal Verifying...');
        const principalVerify = await axios.put(`${BASE_URL}/budget-proposals/${proposalId}/verify`, {
            remarks: 'Verified & Accepted by Principal'
        }, { headers: principalHeaders });
        console.log(`Principal Verify success. Status: ${principalVerify.data.data.proposal.status}`);

        // 8. Login as Office
        console.log('\n[8] Logging in as Office...');
        const officeLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'office@bms.com',
            password: 'office123'
        });
        const officeHeaders = { Authorization: `Bearer ${officeLogin.data.data.token}` };

        // 9. Office Approves (Allocation)
        console.log('[9] Office Approving (Allocation)...');
        const officeApprove = await axios.put(`${BASE_URL}/budget-proposals/${proposalId}/approve`, {
            notes: 'Final Allocation by Office'
        }, { headers: officeHeaders });
        console.log(`Office Approve success. Status: ${officeApprove.data.data.proposal.status}`);
        console.log(`Allocations Created: ${officeApprove.data.data.allocationsCreated}`);

        console.log('\n--- Workflow Verification Complete ---');

    } catch (error) {
        if (error.response) {
            console.error('Test failed with response:', error.response.status, error.response.data);
        } else {
            console.error('Test failed:', error.message);
        }
    }
}

testWorkflow();
