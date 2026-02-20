/**
 * AI Controller for CBMS
 * REST API endpoints for AI-powered insights.
 */

const aiService = require('../services/aiService');

/**
 * @desc    Get spending anomalies
 * @route   GET /api/ai/anomalies
 * @access  Private/Office
 */
const getAnomalies = async (req, res) => {
    try {
        const { financialYear } = req.query;
        const fy = financialYear || aiService.getCurrentFinancialYear();

        const anomalies = await aiService.detectAnomalies(fy);

        res.json({
            success: true,
            data: anomalies,
            financialYear: fy,
            count: anomalies.length
        });
    } catch (error) {
        console.error('Error detecting anomalies:', error);
        res.status(500).json({
            success: false,
            message: 'Error detecting anomalies',
            error: error.message
        });
    }
};

/**
 * @desc    Get department risk scores
 * @route   GET /api/ai/risk-scores
 * @access  Private/Office
 */
const getRiskScores = async (req, res) => {
    try {
        const { financialYear } = req.query;
        const fy = financialYear || aiService.getCurrentFinancialYear();

        const riskScores = await aiService.calculateRiskScores(fy);

        res.json({
            success: true,
            data: riskScores,
            financialYear: fy,
            count: riskScores.length,
            summary: {
                high: riskScores.filter(r => r.riskLevel === 'High').length,
                medium: riskScores.filter(r => r.riskLevel === 'Medium').length,
                low: riskScores.filter(r => r.riskLevel === 'Low').length
            }
        });
    } catch (error) {
        console.error('Error calculating risk scores:', error);
        res.status(500).json({
            success: false,
            message: 'Error calculating risk scores',
            error: error.message
        });
    }
};

/**
 * @desc    Get prioritized approval queue
 * @route   GET /api/ai/approval-priority
 * @access  Private/Office
 */
const getApprovalPriority = async (req, res) => {
    try {
        const result = await aiService.prioritizeApprovals();

        res.json({
            success: true,
            data: result.expenditures,
            summary: result.summary
        });
    } catch (error) {
        console.error('Error prioritizing approvals:', error);
        res.status(500).json({
            success: false,
            message: 'Error prioritizing approvals',
            error: error.message
        });
    }
};

/**
 * @desc    Get year-over-year comparison
 * @route   GET /api/ai/year-comparison
 * @access  Private/Office
 */
const getYearComparison = async (req, res) => {
    try {
        const { currentFY, previousFY } = req.query;

        const current = currentFY || aiService.getCurrentFinancialYear();

        // Calculate previous FY if not provided
        let previous = previousFY;
        if (!previous) {
            const [startYear] = current.split('-').map(Number);
            previous = `${startYear - 1}-${startYear}`;
        }

        const comparison = await aiService.generateYearComparison(current, previous);

        res.json({
            success: true,
            data: comparison
        });
    } catch (error) {
        console.error('Error generating year comparison:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating year comparison',
            error: error.message
        });
    }
};

/**
 * @desc    Get AI-generated insights and explanations
 * @route   GET /api/ai/insights
 * @access  Private/Office
 */
const getInsights = async (req, res) => {
    try {
        const { financialYear } = req.query;
        const fy = financialYear || aiService.getCurrentFinancialYear();

        const insights = await aiService.generateExplanation(fy);

        res.json({
            success: true,
            data: insights,
            financialYear: fy
        });
    } catch (error) {
        console.error('Error generating insights:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating insights',
            error: error.message
        });
    }
};

/**
 * @desc    Get system health and rule violations
 * @route   GET /api/ai/health
 * @access  Private/Admin
 */
const getSystemHealth = async (req, res) => {
    try {
        const { financialYear } = req.query;
        const fy = financialYear || aiService.getCurrentFinancialYear();

        const health = await aiService.detectRuleViolations(fy);

        res.json({
            success: true,
            data: health,
            financialYear: fy
        });
    } catch (error) {
        console.error('Error checking system health:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking system health',
            error: error.message
        });
    }
};

/**
 * @desc    Get all AI data in one call (dashboard summary)
 * @route   GET /api/ai/dashboard
 * @access  Private/Office
 */
const getDashboardSummary = async (req, res) => {
    try {
        const { financialYear } = req.query;
        const fy = financialYear || aiService.getCurrentFinancialYear();

        // Fetch all AI data in parallel
        const [anomalies, riskScores, insights, health] = await Promise.all([
            aiService.detectAnomalies(fy),
            aiService.calculateRiskScores(fy),
            aiService.generateExplanation(fy),
            aiService.detectRuleViolations(fy)
        ]);

        res.json({
            success: true,
            data: {
                anomalies: {
                    items: anomalies.slice(0, 5), // Top 5 anomalies
                    total: anomalies.length
                },
                riskScores: {
                    items: riskScores.slice(0, 5), // Top 5 high-risk
                    total: riskScores.length,
                    summary: {
                        high: riskScores.filter(r => r.riskLevel === 'High').length,
                        medium: riskScores.filter(r => r.riskLevel === 'Medium').length,
                        low: riskScores.filter(r => r.riskLevel === 'Low').length
                    }
                },
                insights,
                health
            },
            financialYear: fy
        });
    } catch (error) {
        console.error('Error generating dashboard summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating dashboard summary',
            error: error.message
        });
    }
};

module.exports = {
    getAnomalies,
    getRiskScores,
    getApprovalPriority,
    getYearComparison,
    getInsights,
    getSystemHealth,
    getDashboardSummary
};
