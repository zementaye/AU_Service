const ADMIN = "Super Admin";
const FOCAL = "Focal Point";
const HANDLER = "Handler";

/**
 * Computes which actions a given user can take on a given request. Single
 * source of truth so the list page (quick actions, "needs my action" tab)
 * and the detail page never drift out of sync with each other or with the
 * backend's own requireRole checks.
 */
export function getRequestActions(request, user) {
  if (!request || !user) {
    return {
      canSubmit: false,
      canBeginReview: false,
      canAccept: false,
      canReject: false,
      canComplete: false,
      canConfirmClose: false,
      canReopen: false,
    };
  }

  const isRequester = request.created_by === user.id;
  const isSameDept = user.role === ADMIN || request.target_dept_id === user.department_id;
  const isAssignedHandler = request.assigned_handler_id === user.id;

  return {
    canSubmit: request.status === "Draft" && isRequester,
    canBeginReview: request.status === "Submitted" && [FOCAL, ADMIN].includes(user.role) && isSameDept,
    canAccept: request.status === "Under Review" && [FOCAL, ADMIN].includes(user.role) && isSameDept,
    canReject:
      ["Submitted", "Under Review"].includes(request.status) &&
      [FOCAL, ADMIN].includes(user.role) &&
      isSameDept,
    canComplete: request.status === "Assigned" && (user.role === ADMIN || isAssignedHandler),
    canConfirmClose: request.status === "Completed" && isRequester,
    canReopen: request.status === "Completed" && isRequester,
  };
}

export function hasAnyAction(actions) {
  return Object.values(actions).some(Boolean);
}

export { ADMIN, FOCAL, HANDLER };
