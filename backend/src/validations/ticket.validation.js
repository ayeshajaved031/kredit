// ==============================================================
// Support Ticket Validations
// ==============================================================

const mongoose = require("mongoose");

const VALID_CATEGORIES = [
  "billing_issue",
  "contract_question",
  "technical_problem",
  "kyc_query",
  "payment_failure",
  "other",
];

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"];

const createTicket = (data) => {
  const errors = {};

  if (!data.subject || typeof data.subject !== "string" || !data.subject.trim()) {
    errors.subject = "Subject is required";
  } else if (data.subject.length > 150) {
    errors.subject = "Subject cannot exceed 150 characters";
  }

  if (!data.description || typeof data.description !== "string" || !data.description.trim()) {
    errors.description = "Description is required";
  } else if (data.description.length > 2000) {
    errors.description = "Description cannot exceed 2000 characters";
  } else if (data.description.length < 10) {
    errors.description = "Please provide more detail (at least 10 characters)";
  }

  if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
    errors.category = `Category must be one of: ${VALID_CATEGORIES.join(", ")}`;
  }

  if (data.priority !== undefined && !VALID_PRIORITIES.includes(data.priority)) {
    errors.priority = `Priority must be one of: ${VALID_PRIORITIES.join(", ")}`;
  }

  if (data.relatedContractId !== undefined && data.relatedContractId !== null && data.relatedContractId !== "") {
    if (!mongoose.Types.ObjectId.isValid(data.relatedContractId)) {
      errors.relatedContractId = "Invalid contract ID";
    }
  }

  return Object.keys(errors).length ? errors : null;
};

const addReply = (data) => {
  if (!data.message || typeof data.message !== "string" || !data.message.trim()) {
    return { message: "Reply message is required" };
  }
  if (data.message.length > 2000) {
    return { message: "Reply cannot exceed 2000 characters" };
  }
  return null;
};

const updateStatus = (data) => {
  if (!data.status || !VALID_STATUSES.includes(data.status)) {
    return { status: `Status must be one of: ${VALID_STATUSES.join(", ")}` };
  }
  return null;
};

const assignTicket = (data) => {
  if (data.assignedTo !== null && !mongoose.Types.ObjectId.isValid(data.assignedTo)) {
    return { assignedTo: "Invalid user ID" };
  }
  return null;
};

module.exports = {
  createTicket,
  addReply,
  updateStatus,
  assignTicket,
};
