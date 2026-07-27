// Mirrors nextStepFor() in backend/src/routes/auth.routes.js. Both the route
// guard and the wizard's post-submit redirect read this, so there's one
// definition of what still has to happen before the member area opens up.
//
// Returns the path the user still owes us, or null when they're done.
export function nextEnrolmentStep(user) {
  if (!user) return null;
  // Admins run the school rather than enrol in it.
  if (user.isAdmin) return null;
  if (!user.profileComplete) return "/onboarding";
  if (!user.paymentComplete) return "/onboarding/payment";
  return null;
}

export function dashboardFor(user) {
  return user?.isAdmin ? "/admin" : "/member";
}

// Where to send someone right after they sign in or finish a step.
export function destinationFor(user) {
  return nextEnrolmentStep(user) || dashboardFor(user);
}
