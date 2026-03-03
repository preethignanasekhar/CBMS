const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/cbms').then(async () => {
    const BudgetProposal = require('./models/BudgetProposal');
    const targetId = new mongoose.Types.ObjectId('699ec9bcb5b4fa0ff69a9ed1');
    const missingItem = {
        budgetHead: new mongoose.Types.ObjectId('699c0c19bfe9392a0340b989'),
        proposedAmount: 400000,
        justification: 'Restored from allocation desync'
    };
    await BudgetProposal.updateOne({ _id: targetId }, { $set: { status: 'approved' } });

    const doc = await BudgetProposal.findById(targetId);
    // Only add if not there
    if (!doc.proposalItems.some(item => item.budgetHead.toString() === '699c0c19bfe9392a0340b989')) {
        doc.proposalItems.push(missingItem);
    }
    await doc.save();
    console.log('Fixed proposal! Total is now:', doc.totalProposedAmount);
    process.exit(0);
}).catch(e => console.log(e));
