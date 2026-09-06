export function canRunEvalMutation() {
  return process.env.RELAY_ALLOW_EVAL_MUTATIONS === "true" || process.env.NODE_ENV !== "production";
}
