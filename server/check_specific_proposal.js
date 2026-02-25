const mongoose = require('mongoose');
require('./models/Department');
require('./models/User');
const BudgetProposal = require('./models/BudgetProposal');
require('dotenv').config();

async function checkProposalDetail() {
    await mongoose.connect(process.env.MONGODB_URI);

    // Find the AI & DS dept first
    const Department = mongoose.model('Department');
    const dept = await Department.findOne({ name: /Artificial Intelligence/i });
    console.log('Dept found:', dept?.name, dept?._id);

    if (dept) {
        const proposal = await BudgetProposal.findOne({
            department: dept._id,
            totalProposedAmount: 3000
        });
        if (proposal) {
            console.log('Proposal found:', {
                id: proposal._id,
                status: proposal.status,
                readBy: proposal.readBy,
                approvalSteps: proposal.approvalSteps
            });
        } else {
            console.log('Proposal not found for this dept/amount');
        }
    }

    await mongoose.connection.close();
}

checkProposalDetail();
