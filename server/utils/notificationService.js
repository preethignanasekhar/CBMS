const sgMail = require('@sendgrid/mail');
const Notification = require('../models/Notification');
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const { sendPushNotification } = require('../services/pushService');
const { emitToUser } = require('../services/socketService');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Email configuration
const emailConfig = {
  from: {
    email: process.env.EMAIL_FROM,
    name: process.env.EMAIL_FROM_NAME
  }
};

// Notification templates
const notificationTemplates = {
  expenditure_submitted: {
    title: 'New Expenditure Submitted',
    message: 'A new expenditure request has been submitted and requires your review.',
    priority: 'medium',
    actionRequired: true
  },
  expenditure_verified: {
    title: 'Expenditure Verified',
    message: 'Your expenditure request has been verified by the HOD and forwarded for approval.',
    priority: 'medium',
    actionRequired: false
  },
  expenditure_approved: {
    title: 'Expenditure Approved',
    message: 'Your expenditure request has been approved and the amount has been deducted from your budget.',
    priority: 'high',
    actionRequired: false
  },
  expenditure_rejected: {
    title: 'Expenditure Rejected',
    message: 'Your expenditure request has been rejected. Please review the remarks and resubmit if needed.',
    priority: 'high',
    actionRequired: true
  },
  budget_allocation_created: {
    title: 'Budget Allocation Created',
    message: 'A new budget allocation has been created for your department.',
    priority: 'medium',
    actionRequired: false
  },
  budget_exhaustion_warning: {
    title: 'Budget Exhaustion Warning',
    message: 'Your department budget is running low. Please review your expenditures.',
    priority: 'urgent',
    actionRequired: true
  },
  approval_reminder: {
    title: 'Approval Reminder',
    message: 'You have pending expenditure requests that require your approval.',
    priority: 'medium',
    actionRequired: true
  },
  attachments_missing: {
    title: 'Attachments Missing',
    message: 'Your expenditure request is missing required attachments. Please upload them to proceed.',
    priority: 'high',
    actionRequired: true
  },
  proposal_submitted: {
    title: 'New Budget Proposal Submitted',
    message: 'A new annual budget proposal has been submitted and requires your verification.',
    priority: 'high',
    actionRequired: true
  },
  proposal_verified: {
    title: 'Budget Proposal Verified',
    message: 'Your budget proposal has been verified by the HOD and forwarded for approval.',
    priority: 'medium',
    actionRequired: false
  },
  proposal_rejected: {
    title: 'Budget Proposal Rejected',
    message: 'Your budget proposal has been rejected. Please review the remarks and resubmit if needed.',
    priority: 'high',
    actionRequired: true
  }
};

// Email templates
const emailTemplates = {
  expenditure_submitted: (data) => ({
    subject: `New Expenditure Request - ${data.billNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">New Expenditure Request</h2>
        <p>A new expenditure request has been submitted and requires your review:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Bill Number:</strong> ${data.billNumber}</p>
          <p><strong>Amount:</strong> ₹${data.billAmount.toLocaleString()}</p>
          <p><strong>Party:</strong> ${data.partyName}</p>
          <p><strong>Department:</strong> ${data.department}</p>
          <p><strong>Budget Head:</strong> ${data.budgetHead}</p>
        </div>
        <p>Please review and take appropriate action.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/approvals" 
           style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Review Request
        </a>
      </div>
    `
  }),
  expenditure_approved: (data) => ({
    subject: `Expenditure Approved - ${data.billNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Expenditure Approved</h2>
        <p>Your expenditure request has been approved:</p>
        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Bill Number:</strong> ${data.billNumber}</p>
          <p><strong>Amount:</strong> ₹${data.billAmount.toLocaleString()}</p>
          <p><strong>Party:</strong> ${data.partyName}</p>
          <p><strong>Status:</strong> Approved</p>
        </div>
        <p>The amount has been deducted from your department budget.</p>
      </div>
    `
  }),
  expenditure_rejected: (data) => ({
    subject: `Expenditure Rejected - ${data.billNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Expenditure Rejected</h2>
        <p>Your expenditure request has been rejected:</p>
        <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Bill Number:</strong> ${data.billNumber}</p>
          <p><strong>Amount:</strong> ₹${data.billAmount.toLocaleString()}</p>
          <p><strong>Party:</strong> ${data.partyName}</p>
          <p><strong>Status:</strong> Rejected</p>
          <p><strong>Remarks:</strong> ${data.remarks}</p>
        </div>
        <p>Please review the remarks and resubmit with corrections if needed.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/expenditures" 
           style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Expenditures
        </a>
      </div>
    `
  }),
  budget_exhaustion_warning: (data) => ({
    subject: `Budget Exhaustion Warning - ${data.department}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ffc107;">Budget Exhaustion Warning</h2>
        <p>Your department budget is running low:</p>
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Department:</strong> ${data.department}</p>
          <p><strong>Budget Head:</strong> ${data.budgetHead}</p>
          <p><strong>Allocated:</strong> ₹${data.allocatedAmount.toLocaleString()}</p>
          <p><strong>Spent:</strong> ₹${data.spentAmount.toLocaleString()}</p>
          <p><strong>Remaining:</strong> ₹${data.remainingAmount.toLocaleString()}</p>
          <p><strong>Utilization:</strong> ${data.utilizationPercentage.toFixed(1)}%</p>
        </div>
        <p>Please review your expenditures and budget allocation.</p>
      </div>
    `
  })
};

// Create in-app notification
const createNotification = async (notificationData) => {
  try {
    const template = notificationTemplates[notificationData.type];
    if (!template) {
      throw new Error(`Unknown notification type: ${notificationData.type}`);
    }

    const notification = await Notification.create({
      recipient: notificationData.recipient,
      title: notificationData.title || template.title,
      message: notificationData.message || template.message,
      type: notificationData.type,
      relatedEntity: notificationData.relatedEntity,
      relatedEntityId: notificationData.relatedEntityId,
      priority: notificationData.priority || template.priority,
      actionRequired: notificationData.actionRequired !== undefined ? notificationData.actionRequired : template.actionRequired,
      actionUrl: notificationData.actionUrl,
      metadata: notificationData.metadata
    });



    // Send Realtime Web Push
    try {
      const subscriptions = await PushSubscription.find({ user: notificationData.recipient });

      if (subscriptions.length > 0) {
        const payload = {
          title: notification.title,
          body: notification.message,
          icon: '/logo192.png', // Ensure this exists in public/ or adjust
          data: {
            url: notification.actionUrl,
            ...notification.metadata
          }
        };

        const promises = subscriptions.map(sub => sendPushNotification(sub, payload));
        await Promise.allSettled(promises);
      }
    } catch (pushError) {
      console.error('Error sending push notification:', pushError);
      // Don't fail the database creation
    }

    // Send Real-time Socket Notification
    emitToUser(notificationData.recipient, 'notification', notification);

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Send email notification using SendGrid
const sendEmailNotification = async (recipientEmail, type, data) => {
  try {
    // Check if we have a dynamic template for this type
    const templateId = getTemplateId(type);

    if (templateId) {
      // Use dynamic template
      await sendTemplateEmail(recipientEmail, templateId, data);
    } else {
      // Use inline template
      const emailTemplate = emailTemplates[type];
      if (!emailTemplate) {
        console.log(`No email template for type: ${type}`);
        return;
      }

      const emailContent = emailTemplate(data);

      const msg = {
        to: recipientEmail,
        from: emailConfig.from,
        subject: emailContent.subject,
        html: emailContent.html
      };

      await sgMail.send(msg);
    }

    console.log(`Email sent to ${recipientEmail} for ${type}`);
  } catch (error) {
    console.error('Error sending email:', error);

    // Handle specific SendGrid errors
    if (error.response) {
      const errorBody = error.response.body;
      console.error('SendGrid error response:', errorBody);

      // Check for sender verification error
      if (errorBody.errors && errorBody.errors.some(err =>
        err.message.includes('verified Sender Identity') ||
        err.message.includes('sender authentication')
      )) {
        console.error('🚨 SENDER VERIFICATION ERROR:');
        console.error('The from email address is not verified in SendGrid.');
        console.error('Please verify your sender identity at: https://app.sendgrid.com/settings/sender_auth');
        console.error('Or update EMAIL_FROM in your .env file to use a verified email address.');

        // Try to send with a fallback email if configured
        if (process.env.EMAIL_FROM_FALLBACK) {
          console.log('Attempting to send with fallback email...');
          try {
            const fallbackMsg = {
              ...msg,
              from: {
                email: process.env.EMAIL_FROM_FALLBACK,
                name: emailConfig.from.name
              }
            };
            await sgMail.send(fallbackMsg);
            console.log(`Email sent successfully using fallback address: ${process.env.EMAIL_FROM_FALLBACK}`);
            return;
          } catch (fallbackError) {
            console.error('Fallback email also failed:', fallbackError.message);
          }
        }
      }
    }

    // Don't throw error to prevent breaking the main flow
    // Just log the error and continue
  }
};

// Get template ID for email type
const getTemplateId = (type) => {
  const templateMap = {
    'expenditure_submitted': process.env.SENDGRID_EXPENDITURE_SUBMISSION_TEMPLATE_ID,
    'expenditure_approved': process.env.SENDGRID_EXPENDITURE_APPROVAL_TEMPLATE_ID,
    'expenditure_rejected': process.env.SENDGRID_EXPENDITURE_REJECTION_TEMPLATE_ID,
    'budget_exhaustion_warning': process.env.SENDGRID_BUDGET_WARNING_TEMPLATE_ID,
    'welcome': process.env.SENDGRID_WELCOME_TEMPLATE_ID,
    'password_reset': process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID
  };

  return templateMap[type];
};

// Send email using SendGrid dynamic template
const sendTemplateEmail = async (recipientEmail, templateId, dynamicData) => {
  try {
    const msg = {
      to: recipientEmail,
      from: emailConfig.from,
      templateId: templateId,
      dynamicTemplateData: dynamicData
    };

    await sgMail.send(msg);
    console.log(`Template email sent to ${recipientEmail} using template ${templateId}`);
  } catch (error) {
    console.error('Error sending template email:', error);
    if (error.response) {
      console.error('SendGrid template error response:', error.response.body);
    }
    throw error;
  }
};

// Send notification to multiple recipients
const sendBulkNotification = async (recipients, notificationData) => {
  const notifications = [];

  for (const recipientId of recipients) {
    try {
      const notification = await createNotification({
        ...notificationData,
        recipient: recipientId
      });
      notifications.push(notification);
    } catch (error) {
      console.error(`Error creating notification for user ${recipientId}:`, error);
    }
  }

  return notifications;
};

// Get users by role for notifications
const getUsersByRole = async (roles) => {
  try {
    const users = await User.find({
      role: { $in: roles },
      isActive: true
    }).select('_id email name role');
    return users;
  } catch (error) {
    console.error('Error fetching users by role:', error);
    return [];
  }
};

// Send expenditure submission notifications
const notifyExpenditureSubmission = async (expenditure) => {
  try {
    // Get HOD and Office users
    const hodUsers = await getUsersByRole(['hod']);
    const officeUsers = await getUsersByRole(['office']);
    const principalUsers = await getUsersByRole(['principal', 'vice_principal']);

    const recipients = [
      ...hodUsers.filter(user => user.department && user.department.toString() === expenditure.department.toString()),
      ...officeUsers,
      ...principalUsers
    ].map(user => user._id);

    // Create in-app notifications
    await sendBulkNotification(recipients, {
      type: 'expenditure_submitted',
      relatedEntity: 'Expenditure',
      relatedEntityId: expenditure._id,
      actionUrl: '/approvals',
      metadata: {
        billNumber: expenditure.billNumber,
        billAmount: expenditure.billAmount,
        partyName: expenditure.partyName,
        department: expenditure.department.name,
        budgetHead: expenditure.budgetHead.name
      }
    });

    // Send email notifications
    const emailRecipients = [
      ...hodUsers.filter(user => user.department && user.department.toString() === expenditure.department.toString()),
      ...officeUsers,
      ...principalUsers
    ];

    for (const user of emailRecipients) {
      await sendEmailNotification(user.email, 'expenditure_submitted', {
        billNumber: expenditure.billNumber,
        billAmount: expenditure.billAmount,
        partyName: expenditure.partyName,
        department: expenditure.department.name,
        budgetHead: expenditure.budgetHead.name
      });
    }
  } catch (error) {
    console.error('Error sending expenditure submission notifications:', error);
  }
};

// Send expenditure approval notifications
const notifyExpenditureApproval = async (expenditure, approver) => {
  try {
    // Notify the submitter
    await createNotification({
      recipient: expenditure.submittedBy,
      type: 'expenditure_approved',
      relatedEntity: 'Expenditure',
      relatedEntityId: expenditure._id,
      actionUrl: '/expenditures',
      metadata: {
        billNumber: expenditure.billNumber,
        billAmount: expenditure.billAmount,
        partyName: expenditure.partyName,
        approver: approver.name
      }
    });

    // Send email to submitter
    const submitter = await User.findById(expenditure.submittedBy);
    if (submitter) {
      await sendEmailNotification(submitter.email, 'expenditure_approved', {
        billNumber: expenditure.billNumber,
        billAmount: expenditure.billAmount,
        partyName: expenditure.partyName
      });
    }
  } catch (error) {
    console.error('Error sending expenditure approval notifications:', error);
  }
};

// Send expenditure rejection notifications
const notifyExpenditureRejection = async (expenditure, approver, remarks) => {
  try {
    // Notify the submitter
    await createNotification({
      recipient: expenditure.submittedBy,
      type: 'expenditure_rejected',
      relatedEntity: 'Expenditure',
      relatedEntityId: expenditure._id,
      actionUrl: '/expenditures',
      metadata: {
        billNumber: expenditure.billNumber,
        billAmount: expenditure.billAmount,
        partyName: expenditure.partyName,
        approver: approver.name,
        remarks
      }
    });

    // Send email to submitter
    const submitter = await User.findById(expenditure.submittedBy);
    if (submitter) {
      await sendEmailNotification(submitter.email, 'expenditure_rejected', {
        billNumber: expenditure.billNumber,
        billAmount: expenditure.billAmount,
        partyName: expenditure.partyName,
        remarks
      });
    }
  } catch (error) {
    console.error('Error sending expenditure rejection notifications:', error);
  }
};

// Send budget exhaustion warning
const notifyBudgetExhaustion = async (allocation) => {
  try {
    const departmentUsers = await User.find({
      department: allocation.department,
      role: { $in: ['department', 'hod'] },
      isActive: true
    });

    const utilizationPercentage = (allocation.spentAmount / allocation.allocatedAmount) * 100;

    // Only notify if utilization is above 90% (remaining < 10%)
    if (utilizationPercentage < 90) {
      return;
    }

    for (const user of departmentUsers) {
      await createNotification({
        recipient: user._id,
        type: 'budget_exhaustion_warning',
        relatedEntity: 'Allocation',
        relatedEntityId: allocation._id,
        actionUrl: '/dashboard',
        metadata: {
          department: allocation.department.name,
          budgetHead: allocation.budgetHead.name,
          allocatedAmount: allocation.allocatedAmount,
          spentAmount: allocation.spentAmount,
          remainingAmount: allocation.remainingAmount,
          utilizationPercentage
        }
      });

      await sendEmailNotification(user.email, 'budget_exhaustion_warning', {
        department: allocation.department.name,
        budgetHead: allocation.budgetHead.name,
        allocatedAmount: allocation.allocatedAmount,
        spentAmount: allocation.spentAmount,
        remainingAmount: allocation.remainingAmount,
        utilizationPercentage
      });
    }
  } catch (error) {
    console.error('Error sending budget exhaustion notifications:', error);
  }
};

// Send approval reminders
const sendApprovalReminders = async () => {
  try {
    const pendingExpenditures = await Expenditure.find({
      status: { $in: ['pending', 'verified'] },
      createdAt: { $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Older than 7 days
    }).populate('department budgetHead');

    const approvers = await getUsersByRole(['office', 'vice_principal', 'principal']);

    for (const approver of approvers) {
      const pendingCount = pendingExpenditures.length;

      if (pendingCount > 0) {
        await createNotification({
          recipient: approver._id,
          type: 'approval_reminder',
          actionUrl: '/approvals',
          metadata: { pendingCount }
        });
      }
    }
  } catch (error) {
    console.error('Error sending approval reminders:', error);
  }
};

// Send budget proposal submission notifications
const notifyProposalSubmission = async (proposal) => {
  try {
    // Get HOD users in the same department
    const hodUsers = await getUsersByRole(['hod']);

    // Filter HODs for this department
    const departmentHodUsers = hodUsers.filter(
      user => user._id.toString() !== proposal.submittedBy.toString() // Don't notify the submittor if they are HOD
    );

    const recipients = departmentHodUsers.map(user => user._id);

    if (recipients.length > 0) {
      await sendBulkNotification(recipients, {
        type: 'proposal_submitted',
        relatedEntity: 'BudgetProposal',
        relatedEntityId: proposal._id,
        actionUrl: '/hod-dashboard',
        metadata: {
          financialYear: proposal.financialYear,
          department: proposal.department.name,
          amount: proposal.totalProposedAmount
        }
      });
    }
  } catch (error) {
    console.error('Error sending proposal submission notifications:', error);
  }
};

// Send budget proposal status change notifications
const notifyProposalStatusChange = async (proposal, action, remarks) => {
  try {
    const type = action === 'verify' ? 'proposal_verified' : 'proposal_rejected';

    await createNotification({
      recipient: proposal.submittedBy,
      type: type,
      relatedEntity: 'BudgetProposal',
      relatedEntityId: proposal._id,
      actionUrl: '/budget-proposals',
      metadata: {
        financialYear: proposal.financialYear,
        action,
        remarks
      }
    });
  } catch (error) {
    console.error('Error sending proposal status change notifications:', error);
  }
};

module.exports = {
  createNotification,
  sendEmailNotification,
  sendTemplateEmail,
  sendBulkNotification,
  notifyExpenditureSubmission,
  notifyExpenditureApproval,
  notifyExpenditureRejection,
  notifyBudgetExhaustion,
  sendApprovalReminders,
  notifyProposalSubmission,
  notifyProposalStatusChange
};
