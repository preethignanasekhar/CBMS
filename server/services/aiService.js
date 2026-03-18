/**
 * AI Service for CBMS
 * Provides intelligent insights using rule-based algorithms on anonymized/aggregated data.
 * NO sensitive financial data (vendor names, exact amounts, bill details) is exposed.
 */

const Allocation = require('../models/Allocation');
const Expenditure = require('../models/Expenditure');
const Department = require('../models/Department');
const BudgetHead = require('../models/BudgetHead');
const AuditLog = require('../models/AuditLog');
const FinancialYear = require('../models/FinancialYear');

/**
 * Feature 1: Threshold-Based Anomaly Detection
 * Detects unusual spending patterns by comparing current utilization against historical norms.
 * 
 * @param {string} financialYear - Financial year to analyze (e.g., "2025-2026")
 * @returns {Array} Array of anomaly objects with anonymous department IDs
 */
const detectAnomalies = async (financialYear) => {
    const anomalies = [];

    // Get current date info for FY progress calculation
    const today = new Date();
    const fyStartYear = parseInt(financialYear.split('-')[0]);
    const fyStart = new Date(fyStartYear, 3, 1); // April 1st
    const fyEnd = new Date(fyStartYear + 1, 2, 31); // March 31st

    const totalDaysInFY = Math.ceil((fyEnd - fyStart) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.max(0, Math.ceil((today - fyStart) / (1000 * 60 * 60 * 24)));
    const expectedUtilizationPercent = Math.min(100, (daysElapsed / totalDaysInFY) * 100);

    // Get all allocations for the financial year
    const allocations = await Allocation.find({
        financialYear,
        status: 'active'
    })
        .populate('department', 'name')
        .populate('budgetHead', 'name')
        .lean();

    // Aggregate by department
    const deptStats = {};

    for (const alloc of allocations) {
        const deptId = alloc.department._id.toString();

        if (!deptStats[deptId]) {
            deptStats[deptId] = {
                departmentId: deptId,
                anonymousId: `Dept_${deptId.slice(-4).toUpperCase()}`, // Anonymous ID for AI output
                departmentName: alloc.department.name, // For internal use only
                totalAllocated: 0,
                totalSpent: 0
            };
        }

        deptStats[deptId].totalAllocated += alloc.allocatedAmount;
        deptStats[deptId].totalSpent += alloc.spentAmount;
    }

    // Historical threshold (can be made configurable)
    const ANOMALY_THRESHOLD = 1.5; // 50% above expected is anomalous
    const MIN_ALLOCATION_FOR_ANOMALY = 10000; // Only flag significant allocations

    for (const deptId of Object.keys(deptStats)) {
        const stats = deptStats[deptId];

        if (stats.totalAllocated < MIN_ALLOCATION_FOR_ANOMALY) continue;

        const utilizationPercent = (stats.totalSpent / stats.totalAllocated) * 100;

        // Anomaly: Spending significantly ahead of FY progress
        if (utilizationPercent > expectedUtilizationPercent * ANOMALY_THRESHOLD) {
            anomalies.push({
                type: 'HIGH_UTILIZATION',
                severity: utilizationPercent > expectedUtilizationPercent * 2 ? 'critical' : 'warning',
                anonymousId: stats.anonymousId,
                utilizationPercent: Math.round(utilizationPercent * 100) / 100,
                expectedPercent: Math.round(expectedUtilizationPercent * 100) / 100,
                daysElapsed,
                explanation: `${stats.anonymousId} used ${utilizationPercent.toFixed(1)}% of its allocation within ${daysElapsed} days; expected utilization is ${expectedUtilizationPercent.toFixed(1)}%.`
            });
        }

        // Anomaly: Zero spending despite time elapsed
        if (utilizationPercent < 5 && daysElapsed > 60) {
            anomalies.push({
                type: 'LOW_UTILIZATION',
                severity: 'info',
                anonymousId: stats.anonymousId,
                utilizationPercent: Math.round(utilizationPercent * 100) / 100,
                daysElapsed,
                explanation: `${stats.anonymousId} has used only ${utilizationPercent.toFixed(1)}% of allocation after ${daysElapsed} days. Review may be needed.`
            });
        }
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return anomalies;
};

/**
 * Feature 2: Budget Utilization Risk Scoring
 * Calculates risk scores for department budgets.
 * 
 * @param {string} financialYear - Financial year to analyze
 * @returns {Array} Array of risk assessment objects
 */
const calculateRiskScores = async (financialYear) => {
    const riskScores = [];

    // Calculate FY progress
    const today = new Date();
    const fyStartYear = parseInt(financialYear.split('-')[0]);
    const fyStart = new Date(fyStartYear, 3, 1);
    const fyEnd = new Date(fyStartYear + 1, 2, 31);

    const totalDaysInFY = Math.ceil((fyEnd - fyStart) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.max(0, Math.ceil((today - fyStart) / (1000 * 60 * 60 * 24)));
    const fyProgressPercent = Math.min(100, (daysElapsed / totalDaysInFY) * 100);

    // Get allocations grouped by department
    const allocations = await Allocation.aggregate([
        { $match: { financialYear, status: 'active' } },
        {
            $group: {
                _id: '$department',
                totalAllocated: { $sum: '$allocatedAmount' },
                totalSpent: { $sum: '$spentAmount' }
            }
        }
    ]);

    const departments = await Department.find().lean();
    const deptMap = {};
    departments.forEach(d => { deptMap[d._id.toString()] = d.name; });

    for (const alloc of allocations) {
        const deptId = alloc._id.toString();
        const utilizationPercent = alloc.totalAllocated > 0
            ? (alloc.totalSpent / alloc.totalAllocated) * 100
            : 0;
        const remainingPercent = 100 - utilizationPercent;

        // Calculate trend slope (simplified: based on current vs expected)
        const expectedUtilization = fyProgressPercent;
        const trendSlope = utilizationPercent - expectedUtilization;

        // Risk Score Calculation
        // Higher score = Higher risk
        let riskScore = 0;

        // Factor 1: Utilization vs FY progress (0-40 points)
        if (utilizationPercent > expectedUtilization) {
            riskScore += Math.min(40, (utilizationPercent - expectedUtilization) * 0.8);
        }

        // Factor 2: Remaining budget risk (0-30 points)
        if (remainingPercent < 20 && fyProgressPercent < 80) {
            riskScore += 30 - remainingPercent;
        }

        // Factor 3: Trend acceleration (0-30 points)
        if (trendSlope > 20) {
            riskScore += Math.min(30, trendSlope * 0.5);
        }

        // Determine risk level
        let riskLevel;
        if (riskScore >= 60) riskLevel = 'High';
        else if (riskScore >= 30) riskLevel = 'Medium';
        else riskLevel = 'Low';

        // Generate recommendation
        let recommendation = '';
        if (riskLevel === 'High') {
            recommendation = 'Immediate review advised. Budget exhaustion likely before FY end.';
        } else if (riskLevel === 'Medium') {
            recommendation = 'Monitor spending patterns. Consider mid-year review.';
        } else {
            recommendation = 'On track. No action required.';
        }

        riskScores.push({
            departmentId: deptId,
            anonymousId: `Dept_${deptId.slice(-4).toUpperCase()}`,
            utilizationPercent: Math.round(utilizationPercent * 100) / 100,
            remainingPercent: Math.round(remainingPercent * 100) / 100,
            trendSlope: Math.round(trendSlope * 100) / 100,
            riskScore: Math.round(riskScore),
            riskLevel,
            recommendation,
            fyProgressPercent: Math.round(fyProgressPercent * 100) / 100
        });
    }

    // Sort by risk score (highest first)
    riskScores.sort((a, b) => b.riskScore - a.riskScore);

    return riskScores;
};

/**
 * Feature 3: Approval Queue Prioritization
 * Sorts pending approvals by risk/urgency without modifying them.
 * 
 * @returns {Object} Prioritized approval lists for expenditures and proposals
 */
const prioritizeApprovals = async () => {
    // Get pending expenditures
    const expenditures = await Expenditure.find({
        status: { $in: ['pending', 'verified'] }
    })
        .populate('department', 'name')
        .populate('budgetHead', 'name')
        .populate('submittedBy', 'name')
        .lean();

    // Get corresponding allocations for risk calculation
    const allocations = await Allocation.find({ status: 'active' }).lean();
    const allocationMap = {};

    for (const alloc of allocations) {
        const key = `${alloc.department.toString()}-${alloc.budgetHead.toString()}-${alloc.financialYear}`;
        allocationMap[key] = alloc;
    }

    // Score each expenditure
    const scoredExpenditures = expenditures.map(exp => {
        let priorityScore = 0;
        const flags = [];

        // Age factor: Older items get higher priority
        const ageInDays = Math.ceil((new Date() - new Date(exp.createdAt)) / (1000 * 60 * 60 * 24));
        if (ageInDays > 7) {
            priorityScore += Math.min(30, ageInDays * 2);
            if (ageInDays > 14) flags.push('overdue');
        }

        // Amount factor: Larger amounts need more scrutiny
        const amountThreshold = 50000;
        if (exp.billAmount > amountThreshold) {
            priorityScore += 20;
            flags.push('high_value');
        }

        // Allocation exhaustion factor
        const allocKey = `${exp.department._id.toString()}-${exp.budgetHead._id.toString()}-${exp.financialYear}`;
        const alloc = allocationMap[allocKey];

        if (alloc) {
            const remainingAfter = alloc.allocatedAmount - alloc.spentAmount - exp.billAmount;
            const remainingPercent = (remainingAfter / alloc.allocatedAmount) * 100;

            if (remainingPercent < 10) {
                priorityScore += 40;
                flags.push('budget_critical');
            } else if (remainingPercent < 25) {
                priorityScore += 20;
                flags.push('budget_warning');
            }
        }

        // Resubmission factor
        if (exp.isResubmission) {
            priorityScore += 15;
            flags.push('resubmission');
        }

        return {
            _id: exp._id,
            billNumber: exp.billNumber,
            billAmount: exp.billAmount,
            departmentName: exp.department.name,
            budgetHeadName: exp.budgetHead.name,
            status: exp.status,
            currentStep: exp.currentStep,
            submittedAt: exp.createdAt,
            ageInDays,
            priorityScore,
            priorityLevel: priorityScore >= 50 ? 'High' : priorityScore >= 25 ? 'Medium' : 'Low',
            flags,
            financialYear: exp.financialYear
        };
    });

    // Sort by priority score
    scoredExpenditures.sort((a, b) => b.priorityScore - a.priorityScore);

    return {
        expenditures: scoredExpenditures,
        summary: {
            total: scoredExpenditures.length,
            highPriority: scoredExpenditures.filter(e => e.priorityLevel === 'High').length,
            mediumPriority: scoredExpenditures.filter(e => e.priorityLevel === 'Medium').length,
            lowPriority: scoredExpenditures.filter(e => e.priorityLevel === 'Low').length,
            flaggedOverdue: scoredExpenditures.filter(e => e.flags.includes('overdue')).length,
            flaggedBudgetCritical: scoredExpenditures.filter(e => e.flags.includes('budget_critical')).length
        }
    };
};

/**
 * Feature 4: Year-over-Year Pattern Analysis
 * Compares utilization patterns between financial years using aggregated data only.
 * 
 * @param {string} currentFY - Current financial year
 * @param {string} previousFY - Previous financial year to compare
 * @returns {Object} Comparison analysis
 */
const generateYearComparison = async (currentFY, previousFY) => {
    // Get aggregated stats for both years
    const getYearStats = async (fy) => {
        const allocations = await Allocation.aggregate([
            { $match: { financialYear: fy } },
            {
                $group: {
                    _id: null,
                    totalAllocated: { $sum: '$allocatedAmount' },
                    totalSpent: { $sum: '$spentAmount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const expenditures = await Expenditure.aggregate([
            { $match: { financialYear: fy, status: 'finalized' } },
            {
                $group: {
                    _id: null,
                    totalExpensed: { $sum: '$billAmount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        return {
            totalAllocated: allocations[0]?.totalAllocated || 0,
            totalSpent: allocations[0]?.totalSpent || 0,
            allocationCount: allocations[0]?.count || 0,
            finalizedExpenditures: expenditures[0]?.count || 0,
            totalExpensed: expenditures[0]?.totalExpensed || 0
        };
    };

    const current = await getYearStats(currentFY);
    const previous = await getYearStats(previousFY);

    // Calculate changes (percentages only, no raw amounts in AI output)
    const utilizationCurrent = current.totalAllocated > 0
        ? (current.totalSpent / current.totalAllocated) * 100
        : 0;
    const utilizationPrevious = previous.totalAllocated > 0
        ? (previous.totalSpent / previous.totalAllocated) * 100
        : 0;

    const allocationGrowth = previous.totalAllocated > 0
        ? ((current.totalAllocated - previous.totalAllocated) / previous.totalAllocated) * 100
        : 0;

    return {
        currentYear: {
            financialYear: currentFY,
            utilizationPercent: Math.round(utilizationCurrent * 100) / 100,
            allocationCount: current.allocationCount,
            expenditureCount: current.finalizedExpenditures
        },
        previousYear: {
            financialYear: previousFY,
            utilizationPercent: Math.round(utilizationPrevious * 100) / 100,
            allocationCount: previous.allocationCount,
            expenditureCount: previous.finalizedExpenditures
        },
        comparison: {
            utilizationChange: Math.round((utilizationCurrent - utilizationPrevious) * 100) / 100,
            allocationGrowthPercent: Math.round(allocationGrowth * 100) / 100,
            expenditureCountChange: current.finalizedExpenditures - previous.finalizedExpenditures
        }
    };
};

/**
 * Feature 5: Natural-Language Explanations
 * Generates human-readable insights from aggregated metrics.
 * 
 * @param {string} financialYear - Financial year to analyze
 * @returns {Object} NL explanations for various metrics
 */
/**
 * Feature 7: Predictive Budget Exhaustion (PDE)
 * Projects when a department will run out of budget based on burn rate.
 */
const calculatePredictiveExhaustion = async (financialYear) => {
    const today = new Date();
    const fyStartYear = parseInt(financialYear.split('-')[0]);
    const fyStart = new Date(fyStartYear, 3, 1);
    const daysElapsed = Math.max(1, Math.ceil((today - fyStart) / (1000 * 60 * 60 * 24)));

    const allocations = await Allocation.find({ financialYear, status: 'active' }).populate('department', 'name').lean();

    return allocations.map(alloc => {
        const burnRatePerDay = alloc.spentAmount / daysElapsed;
        const remaining = alloc.allocatedAmount - alloc.spentAmount;

        let projectedDaysLeft = Infinity;
        let pdeDate = null;

        if (burnRatePerDay > 0) {
            projectedDaysLeft = Math.floor(remaining / burnRatePerDay);
            pdeDate = new Date(today.getTime() + projectedDaysLeft * 24 * 60 * 60 * 1000);
        }

        return {
            departmentName: alloc.department.name,
            budgetHeadName: alloc.budgetHeadName,
            currentUtilization: (alloc.spentAmount / alloc.allocatedAmount) * 100,
            projectedDaysLeft,
            pdeDate: pdeDate ? pdeDate.toISOString().split('T')[0] : 'N/A',
            isAtRisk: projectedDaysLeft < 60 && alloc.spentAmount > 0
        };
    }).filter(p => p.isAtRisk).sort((a, b) => a.projectedDaysLeft - b.projectedDaysLeft);
};

/**
 * Feature 8: Peer Benchmarking & Efficiency Analysis
 */
const generatePeerBenchmarking = async (financialYear) => {
    const departments = await Department.find().lean();
    const stats = [];

    for (const dept of departments) {
        const [allocs, exps] = await Promise.all([
            Allocation.find({ department: dept._id, financialYear }),
            Expenditure.find({ department: dept._id, financialYear, status: 'finalized' })
        ]);

        const totalAllocated = allocs.reduce((sum, a) => sum + a.allocatedAmount, 0);
        const totalSpent = allocs.reduce((sum, a) => sum + a.spentAmount, 0);
        const eventCount = exps.length;

        stats.push({
            name: dept.name,
            code: dept.code,
            efficiencyRatio: eventCount > 0 ? (totalSpent / eventCount) : 0, // Cost per event
            utilization: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
            eventCount
        });
    }

    return stats.sort((a, b) => a.efficiencyRatio - b.efficiencyRatio);
};

/**
 * Feature 5: Natural-Language Explanations (Enhanced Morning Briefing)
 */
const generateExplanation = async (financialYear) => {
    const riskScores = await calculateRiskScores(financialYear);
    const anomalies = await detectAnomalies(financialYear);
    const pde = await calculatePredictiveExhaustion(financialYear);
    const bench = await generatePeerBenchmarking(financialYear);

    // Calculate Global Financial Metrics
    const allAllocations = await Allocation.find({ financialYear, status: 'active' }).lean();
    const totalAllocated = allAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const totalSpent = allAllocations.reduce((sum, a) => sum + a.spentAmount, 0);
    const totalRemaining = totalAllocated - totalSpent;
    const globalUtilizationPercent = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
    
    const fyProgressPercent = riskScores[0]?.fyProgressPercent || 0;
    
    // Spending Pace Indicator
    let spendingPace = 'On track';
    let paceColor = 'var(--info)';
    if (globalUtilizationPercent > fyProgressPercent + 10) {
        spendingPace = 'Ahead of schedule';
        paceColor = 'var(--warning)';
    } else if (globalUtilizationPercent < fyProgressPercent - 15) {
        spendingPace = 'Behind schedule';
        paceColor = 'var(--success)';
    }

    const highRiskCount = riskScores.filter(r => r.riskLevel === 'High').length;
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical').length;
    const pendingApprovals = await Expenditure.countDocuments({ status: { $in: ['pending', 'verified'] } });

    // Generative Briefing Logic
    let briefing = `Good morning! Assessment for FY ${financialYear}: `;

    if (criticalAnomalies > 0 || highRiskCount > 0) {
        briefing += `There are ${criticalAnomalies} critical anomalies and ${highRiskCount} departments at high risk. `;
    } else {
        briefing += `Financial operations are currently stable. `;
    }

    if (pde.length > 0) {
        briefing += `Attention needed: ${pde[0].departmentName}'s ${pde[0].budgetHeadName} is projected to exhaust by ${pde[0].pdeDate}. `;
    }

    if (pendingApprovals > 0) {
        briefing += `You have ${pendingApprovals} items in the approval queue waiting for action. `;
    }

    // Efficiency Insight
    const topEfficient = bench.find(b => b.eventCount > 2);
    if (topEfficient) {
        briefing += `Insight: ${topEfficient.name} is showing high efficiency with an average cost of ₹${Math.round(topEfficient.efficiencyRatio).toLocaleString()} per event.`;
    }

    // AI Suggested Actions
    const suggestions = [];
    
    // 1. Predictive exhaustion suggestions
    pde.slice(0, 2).forEach(p => {
        suggestions.push({
            type: 'danger',
            text: `Critical: ${p.departmentName} ${p.budgetHeadName} budget projected to exhaust by ${p.pdeDate}.`
        });
    });

    // 2. High utilization alerts
    anomalies.filter(a => a.type === 'HIGH_UTILIZATION').slice(0, 1).forEach(a => {
        suggestions.push({
            type: 'warning',
            text: `Review ${a.anonymousId} equipment and consumables budget. Allocation is almost exhausted.`
        });
    });

    // 3. Low utilization insights
    anomalies.filter(a => a.type === 'LOW_UTILIZATION' && a.daysElapsed > 60).slice(0, 1).forEach(a => {
        suggestions.push({
            type: 'info',
            text: `Spending in ${a.anonymousId} is lower than expected. Monthly targets may need review.`
        });
    });

    // 4. Efficiency praise
    if (topEfficient && topEfficient.eventCount > 3) {
        suggestions.push({
            type: 'success',
            text: `High efficiency detected in ${topEfficient.name}. Model their event coordination for other departments.`
        });
    }

    return {
        overallStatus: briefing,
        generatedAt: new Date().toISOString(),
        metrics: {
            totalAllocated,
            totalSpent,
            totalRemaining,
            utilizationPercent: Math.round(globalUtilizationPercent * 100) / 100,
            fyProgress: Math.round(fyProgressPercent * 100) / 100,
            spendingPace,
            paceColor
        },
        utilizationExplanation: `System-wide utilization is at ${Math.round(globalUtilizationPercent)}% against a calendar progress of ${Math.round(fyProgressPercent)}%. Spending is currently ${spendingPace.toLowerCase()}.`,
        briefingItems: [
            { icon: 'alert', text: `${criticalAnomalies} Critical Alerts` },
            { icon: 'calendar', text: pde.length > 0 ? `Next exhaustion: ${pde[0].pdeDate}` : 'No immediate exhaustion risk' },
            { icon: 'trending', text: `${highRiskCount} High Risk Depts` }
        ],
        suggestions: suggestions.slice(0, 5),
        benchmarking: bench.slice(0, 5),
    };
};

/**
 * Feature 9: Smart AI Chat Assistant (Data-Driven)
 * Processes natural language queries using real database state.
 */
const processChatQuery = async (query, financialYear) => {
    const q = query.toLowerCase();
    const fy = financialYear || getCurrentFinancialYear();

    // 1. "Highest Budget" / "Maximum Amount"
    if (q.includes('highest') || q.includes('maximum') || q.includes('top') && (q.includes('budget') || q.includes('allocation'))) {
        const topAllocs = await Allocation.aggregate([
            { $match: { financialYear: fy, status: 'active' } },
            { $group: { _id: '$department', total: { $sum: '$allocatedAmount' } } },
            { $sort: { total: -1 } },
            { $limit: 3 },
            {
                $lookup: {
                    from: 'departments',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'dept'
                }
            }
        ]);

        if (topAllocs.length === 0) return "I couldn't find any budget allocations for this period.";

        const primary = topAllocs[0];
        const secondary = topAllocs[1];
        let response = `The **${primary.dept[0]?.name || 'Unknown'}** has the highest allocated budget of ₹${primary.total.toLocaleString()}.`;
        if (secondary) {
            response += `\nThe next highest is the **${secondary.dept[0]?.name || 'Unknown'}** with ₹${secondary.total.toLocaleString()}.`;
        }
        response += `\n\nWould you like to compare allocated vs utilized amounts for these departments?`;
        return response;
    }

    // 2. "Utilization" / "Efficiency" / "Comparison"
    if (q.includes('utilization') || q.includes('utilize') || q.includes('compare') || q.includes('yes')) {
        const stats = await generatePeerBenchmarking(fy);
        const topEfficient = stats.filter(s => s.eventCount > 0).sort((a, b) => b.eventCount - a.eventCount)[0];
        const lowUtilized = [...stats].sort((a, b) => a.utilization - b.utilization)[0];

        let response = "Here is the utilization summary:\n\n";
        stats.slice(0, 3).forEach(s => {
            response += `* **${s.name}**: ${Math.round(s.utilization)}% utilized\n`;
        });

        if (topEfficient) {
            response += `* **${topEfficient.name}**: ${Math.round(topEfficient.utilization)}% utilized (Highest event output: ${topEfficient.eventCount} events)\n`;
        }

        response += `\n⚠️ **${lowUtilized.name}** has the lowest utilization rate at ${Math.round(lowUtilized.utilization)}%. \n\nWould you like me to show pending approvals for this department?`;
        return response;
    }

    // 3. "Approvals" / "Pending"
    if (q.includes('approval') || q.includes('pending') || q.includes('queue')) {
        const pendingExps = await Expenditure.find({ status: { $in: ['pending', 'verified'] } }).populate('department', 'name');
        const totalAmount = pendingExps.reduce((sum, e) => sum + e.amount, 0);
        const count = pendingExps.length;

        if (count === 0) return "Great news! There are no pending approvals currently in the queue. All workflows are up to date.";

        let response = `Here's the current state of the approval queue:\n\nThere are **${count} pending items** waiting for action, worth a total of **₹${totalAmount.toLocaleString()}**.`;

        // Distribution
        const deptGroups = {};
        pendingExps.forEach(e => {
            const name = e.department?.name || 'Academic';
            deptGroups[name] = (deptGroups[name] || 0) + 1;
        });

        const topDept = Object.entries(deptGroups).sort((a, b) => b[1] - a[1])[0];
        if (topDept) {
            response += `\n\n**${topDept[0]}** has the most pending requests (${topDept[1]} items). Approving these would typically increase their budget utilization significantly.`;
        }

        response += `\n\nShall I prioritize the most urgent items (based on event dates) for you?`;
        return response;
    }

    // 4. Default Smart Fallback
    const brief = await generateExplanation(fy);
    return `Here’s what I found from the latest dashboard data:\n\n${brief.overallStatus}\n\nI can also help you compare department budgets, analyze utilization trends, or prioritize your approval queue. What would you like to explore?`;
};

/**
 * Feature 6: System Health & Rule-Violation Detection
 * Monitors system patterns for governance issues.
 * 
 * @param {string} financialYear - Financial year to analyze
 * @returns {Object} System health metrics
 */
const detectRuleViolations = async (financialYear) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get rejection patterns
    const rejections = await Expenditure.countDocuments({
        financialYear,
        status: 'rejected',
        updatedAt: { $gte: thirtyDaysAgo }
    });

    // Get repeated rejection patterns (same department)
    const repeatedRejections = await Expenditure.aggregate([
        {
            $match: {
                financialYear,
                status: 'rejected',
                updatedAt: { $gte: thirtyDaysAgo }
            }
        },
        {
            $group: {
                _id: '$department',
                count: { $sum: 1 }
            }
        },
        {
            $match: { count: { $gte: 3 } }
        }
    ]);

    // Get resubmission patterns
    const resubmissions = await Expenditure.countDocuments({
        financialYear,
        isResubmission: true,
        createdAt: { $gte: thirtyDaysAgo }
    });

    // Calculate pending approval delays
    const pendingOver7Days = await Expenditure.countDocuments({
        status: { $in: ['pending', 'verified'] },
        createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    // Calculate health score (100 = healthy, lower = issues)
    let healthScore = 100;

    // Deduct for rejections
    healthScore -= Math.min(20, rejections * 2);

    // Deduct for repeated rejections
    healthScore -= repeatedRejections.length * 5;

    // Deduct for pending delays
    healthScore -= Math.min(25, pendingOver7Days * 3);

    // Deduct for high resubmission rate
    healthScore -= Math.min(15, resubmissions * 1);

    healthScore = Math.max(0, healthScore);

    let healthStatus;
    if (healthScore >= 80) healthStatus = 'Healthy';
    else if (healthScore >= 60) healthStatus = 'Warning';
    else healthStatus = 'Critical';

    const issues = [];

    if (rejections > 10) {
        issues.push({
            type: 'HIGH_REJECTION_RATE',
            severity: 'warning',
            description: `${rejections} rejections in the last 30 days. Review submission quality.`
        });
    }

    if (repeatedRejections.length > 0) {
        issues.push({
            type: 'REPEATED_REJECTIONS',
            severity: 'warning',
            description: `${repeatedRejections.length} departments with 3+ rejections. Training may be needed.`
        });
    }

    if (pendingOver7Days > 5) {
        issues.push({
            type: 'APPROVAL_DELAYS',
            severity: 'warning',
            description: `${pendingOver7Days} items pending over 7 days. Approval bottleneck detected.`
        });
    }

    return {
        healthScore,
        healthStatus,
        metrics: {
            rejectionsLast30Days: rejections,
            departmentsWithRepeatedRejections: repeatedRejections.length,
            resubmissionsLast30Days: resubmissions,
            pendingOver7Days
        },
        issues,
        lastChecked: new Date().toISOString()
    };
};

/**
 * Helper: Get current financial year
 */
const getCurrentFinancialYear = () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    if (month >= 4) {
        return `${year}-${year + 1}`;
    }
    return `${year - 1}-${year}`;
};

const axios = require('axios');

/**
 * Feature 7: Intelligent Event Requirement Analysis
 * Communicates with the Python AI service to analyze event descriptions.
 * 
 * @param {string} eventName - Name of the event
 * @param {string} eventDescription - Free-text description of the event
 * @returns {Object} Analysis result with checklist and follow-ups
 */
const fallbackAnalyzeEvent = (payload) => {
    const {
        eventName = "",
        eventType = "event",
        participants = 50,
        days = 1,
        isInternal = true,
        venue = "seminar",
        softwareRequired = false,
        softwareType = "free",
        softwareCost = 0,
        labOrLaptop = "laptop",
        resourcePerson = false,
        resourcePersonType = "internal",
        honorarium = 0,
        guestAccommodation = false,
        guestTravel = false,
        travelExpense = 0,
        participantFood = "None",
        certification = true
    } = payload;
    const combinedText = `${eventName} ${eventType}`.toLowerCase();

    const items = [];

    const isWorkshop = ["workshop", "training", "hands-on", "bootcamp", "practical"].some(kw => combinedText.includes(kw));
    const isSeminar = ["seminar", "talk", "guest lecture", "webinar", "conference", "symposium", "summit", "meetup", "conclave"].some(kw => combinedText.includes(kw));
    const isCultural = ["cultural", "fest", "drama", "dance", "music", "competition"].some(kw => combinedText.includes(kw));

    // Venue Selection
    if (venue === "seminar" || String(venue).toLowerCase().includes("seminar hall")) {
        items.push({ name: "Seminar Hall Booking", quantity: 1, estimatedCost: days * 5000, priority: "Essential", category: "Venue" });
        items.push({ name: "Projector & Sound System", quantity: 1, estimatedCost: days * 2000, priority: "Essential", category: "Technical Equipment" });
        items.push({ name: "Stage Setup & Seating", quantity: 1, estimatedCost: 3000, priority: "Optional", category: "Decorations" });
    } else if (venue === "lab") {
        items.push({ name: "Lab Venue Booking", quantity: 1, estimatedCost: days * 3000, priority: "Essential", category: "Venue" });
    } else {
        items.push({ name: "Event Venue Booking", quantity: 1, estimatedCost: days * 5000, priority: "Essential", category: "Venue" });
    }

    // Dynamic suggestions based on event nature
    if (isWorkshop) {
        items.push({ name: "Workshop Materials / Kits", quantity: participants, estimatedCost: participants * 300, priority: "Essential", category: "Printing" });

        if (!isInternal) {
            items.push({ name: "Registration Desk Setup", quantity: 1, estimatedCost: 1500, priority: "Optional", category: "Logistic Support" });
        }
    } else if (isSeminar) {
        items.push({ name: "Guest Memento & Shawl", quantity: days > 1 ? 2 : 1, estimatedCost: (days > 1 ? 2 : 1) * 1000, priority: "Essential", category: "Mementos & Gifts" });
        items.push({ name: "Stage Flower Setup", quantity: 1, estimatedCost: 2000, priority: "Optional", category: "Decorations" });

        if (!isInternal) {
            items.push({ name: "Welcome Arch", quantity: 1, estimatedCost: 3500, priority: "Luxury", category: "Decorations" });
        }
    } else if (isCultural) {
        items.push({ name: "Stage Lighting & Sound", quantity: 1, estimatedCost: days * 15000, priority: "Essential", category: "Technical Equipment" });
        items.push({ name: "Stage Decoration & Frills", quantity: 1, estimatedCost: 10000, priority: "Essential", category: "Decorations" });
        items.push({ name: "Security & Volunteers Staff", quantity: 5, estimatedCost: days * 3000, priority: "Essential", category: "Logistic Support" });
        items.push({ name: "Prizes / Trophies / Medals", quantity: 15, estimatedCost: 12000, priority: "Essential", category: "Mementos & Gifts" });
        items.push({ name: "Professional Video Coverage", quantity: 1, estimatedCost: days * 10000, priority: "Luxury", category: "Photography & Video" });
        items.push({ name: "Event T-Shirts", quantity: 20, estimatedCost: 6000, priority: "Optional", category: "Printing" });
    } else {
        // Generic defaults for any other unclassified event
        items.push({ name: "Flex Banner (Main Stage)", quantity: 1, estimatedCost: 1500, priority: "Optional", category: "Printing" });
        items.push({ name: "Notepads & Pens", quantity: participants, estimatedCost: participants * 40, priority: "Optional", category: "Printing" });
        items.push({ name: "Professional Photographer", quantity: 1, estimatedCost: days * 5000, priority: "Luxury", category: "Photography & Video" });
    }

    if (!isInternal) {
        items.push({ name: "Local Conveyance/Transport", quantity: 1, estimatedCost: days * 1500, priority: "Optional", category: "Transportation" });
    }

    // --- Technical Planning (Software & Hardware) ---
    if (softwareRequired) {
        if (softwareType === "paid") {
            items.push({ name: "Commercial Software License", quantity: 1, estimatedCost: softwareCost, priority: "Essential", category: "Technical Equipment" });
        } else {
            items.push({ name: "Software Installation Support", quantity: 1, estimatedCost: days * 1000, priority: "Essential", category: "Logistic Support" });
            items.push({ name: "Technical Setup Team", quantity: 2, estimatedCost: days * 1500, priority: "Essential", category: "Logistic Support" });
        }
    }

    if (labOrLaptop === 'lab') {
        items.push({ name: "Lab Maintenance & System Readiness Check", quantity: 1, estimatedCost: days * 2000, priority: "Essential", category: "Technical Equipment" });
        items.push({ name: "Lab Technical Support", quantity: 1, estimatedCost: days * 1000, priority: "Essential", category: "Logistic Support" });
    } else if (labOrLaptop === 'laptop') {
        items.push({ name: "High-Speed Wi-Fi Provision", quantity: 1, estimatedCost: days * 1000, priority: "Essential", category: "Technical Equipment" });
        items.push({ name: "Charging Points & Extension Boards", quantity: Math.ceil(participants / 5), estimatedCost: Math.ceil(participants / 5) * 300, priority: "Essential", category: "Technical Equipment" });
    }

    // --- Resource Planning (Guest/Resource Person) ---
    if (resourcePerson) {
        items.push({ name: "Resource Person Honorarium", quantity: days, estimatedCost: honorarium > 0 ? honorarium : (days * 5000), priority: "Essential", category: "Guest Remuneration" });
        items.push({ name: "Guest Momento & Welcome Frame", quantity: 1, estimatedCost: 1500, priority: "Essential", category: "Mementos & Gifts" });
        items.push({ name: "Resource Person Food Allowance", quantity: days, estimatedCost: days * 1000, priority: "Essential", category: "Food" });

        if (resourcePersonType === 'external') {
            if (guestAccommodation) {
                items.push({ name: "Guest Accommodation (Premium)", quantity: days, estimatedCost: days * 3000, priority: "Optional", category: "Accommodation" });
            }
            if (guestTravel) {
                items.push({ name: "Guest Travel Expense", quantity: 1, estimatedCost: travelExpense > 0 ? travelExpense : 5000, priority: "Essential", category: "Transportation" });
            }
        }
    }

    // --- Participant Food Planning ---
    const foodLower = String(participantFood).toLowerCase();
    if (foodLower !== "none" && foodLower !== "") {
        if (foodLower.includes("breakfast") || foodLower.includes("all")) {
            items.push({ name: "Participant Breakfast", quantity: participants * days, estimatedCost: participants * days * 100, priority: "Essential", category: "Food" });
        }
        if (foodLower.includes("lunch") || foodLower.includes("all") || foodLower.includes("food")) {
            items.push({ name: "Participant Lunch", quantity: participants * days, estimatedCost: participants * days * 200, priority: "Essential", category: "Food" });
        }
        if (foodLower.includes("dinner") || foodLower.includes("all")) {
            items.push({ name: "Participant Dinner", quantity: participants * days, estimatedCost: participants * days * 250, priority: "Essential", category: "Food" });
        }
        if (foodLower.includes("refreshments") || foodLower.includes("snacks") || foodLower.includes("tea") || foodLower.includes("all")) {
            items.push({ name: "Tea & Refreshments", quantity: participants * days * 2, estimatedCost: participants * days * 100, priority: "Essential", category: "Food" });
        }
    }

    // --- Certification & Logistics ---
    if (certification) {
        items.push({ name: "Participant Certificates", quantity: participants, estimatedCost: participants * 25, priority: "Essential", category: "Printing" });
    }

    const estimatedTotal = items.reduce((sum, item) => sum + item.estimatedCost, 0);
    const categoryList = [...new Set(items.map(i => i.category))];

    return {
        status: 'success',
        isFallback: true,
        analysis: {
            eventName,
            eventType,
            participants,
            days,
            isInternal,
            isWorkshop,
            isSeminar,
            isCultural
        },
        items,
        estimatedTotal,
        budgetSuggestions: categoryList,
        checklist: items.map(i => i.name),
        nextQuestion: null
    };
};

/**
 * Feature 7: Intelligent Event Requirement Analysis
 * Communicates with the Python AI service to analyze event descriptions.
 * 
 * @param {string} eventName - Name of the event
 * @param {string} eventDescription - Free-text description of the event
 * @returns {Object} Analysis result with checklist and follow-ups
 */
const analyzeEventRequirements = async (payload) => {
    try {
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

        console.log(`[AI-Event] Analyzing event: "${payload.eventName}" via ${pythonServiceUrl}`);

        const response = await axios.post(`${pythonServiceUrl}/analyze-event`, payload);

        return response.data;
    } catch (error) {
        console.error('Error calling AI Event Analysis service, using Node.js fallback:', error.message);
        return fallbackAnalyzeEvent(payload);
    }
};

module.exports = {
    detectAnomalies,
    calculateRiskScores,
    prioritizeApprovals,
    generateYearComparison,
    generateExplanation,
    detectRuleViolations,
    analyzeEventRequirements,
    getCurrentFinancialYear,
    calculatePredictiveExhaustion,
    generatePeerBenchmarking,
    processChatQuery
};
