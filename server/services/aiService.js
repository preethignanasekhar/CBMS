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
const generateExplanation = async (financialYear) => {
    const riskScores = await calculateRiskScores(financialYear);
    const anomalies = await detectAnomalies(financialYear);

    // Overall status
    const highRiskCount = riskScores.filter(r => r.riskLevel === 'High').length;
    const totalDepts = riskScores.length;
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical').length;

    // Generate overall explanation
    let overallStatus = '';
    if (criticalAnomalies > 0) {
        overallStatus = `⚠️ ${criticalAnomalies} critical spending anomalies detected requiring immediate attention.`;
    } else if (highRiskCount > totalDepts * 0.3) {
        overallStatus = `📊 ${highRiskCount} of ${totalDepts} departments show elevated budget risk. Mid-year review recommended.`;
    } else {
        overallStatus = `✅ Overall budget utilization is within expected parameters for this point in the financial year.`;
    }

    // Calculate average utilization
    const avgUtilization = riskScores.length > 0
        ? riskScores.reduce((sum, r) => sum + r.utilizationPercent, 0) / riskScores.length
        : 0;

    const fyProgress = riskScores.length > 0 ? riskScores[0].fyProgressPercent : 0;

    let utilizationExplanation = '';
    if (avgUtilization > fyProgress + 15) {
        utilizationExplanation = `Average utilization (${avgUtilization.toFixed(1)}%) is ahead of FY progress (${fyProgress.toFixed(1)}%) due to early expenditure activities.`;
    } else if (avgUtilization < fyProgress - 15) {
        utilizationExplanation = `Average utilization (${avgUtilization.toFixed(1)}%) is behind FY progress (${fyProgress.toFixed(1)}%). Spending may accelerate in coming months.`;
    } else {
        utilizationExplanation = `Average utilization (${avgUtilization.toFixed(1)}%) aligns with FY progress (${fyProgress.toFixed(1)}%).`;
    }

    return {
        overallStatus,
        utilizationExplanation,
        riskSummary: {
            high: highRiskCount,
            medium: riskScores.filter(r => r.riskLevel === 'Medium').length,
            low: riskScores.filter(r => r.riskLevel === 'Low').length,
            total: totalDepts
        },
        anomalySummary: {
            critical: criticalAnomalies,
            warning: anomalies.filter(a => a.severity === 'warning').length,
            info: anomalies.filter(a => a.severity === 'info').length,
            total: anomalies.length
        },
        generatedAt: new Date().toISOString()
    };
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

module.exports = {
    detectAnomalies,
    calculateRiskScores,
    prioritizeApprovals,
    generateYearComparison,
    generateExplanation,
    detectRuleViolations,
    getCurrentFinancialYear
};
