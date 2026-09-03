import { reviewDecisionAction } from "@/app/actions";
import { listPendingReviews } from "@/lib/services/run-service";
import { money, shortId, titleize } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const reviews = await listPendingReviews();
  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Review</h1>
          <p>High-risk known intent requiring authorization. Technical unknowns are routed to manual investigation instead.</p>
        </div>
      </div>
      <section className="grid">
        {reviews.map((review) => (
          <article className="card" key={review.id}>
            <span className="badge status-WAITING_REVIEW">Pending Review</span>
            <h2>{review.claim_id}</h2>
            <p>{review.request_text}</p>
            <div className="fact">
              <strong>Requested action</strong>
              <span>
                {titleize(review.action_type)}{" "}
                {review.arguments_json.amountCents ? money(review.arguments_json.amountCents) : ""}
              </span>
            </div>
            <div className="fact">
              <strong>Policy reason</strong>
              <span>{review.reason_code}</span>
            </div>
            <p>
              Run {shortId(review.run_id)} · planned version {review.expected_version_at_plan}
            </p>
            <form action={reviewDecisionAction}>
              <input type="hidden" name="reviewId" value={review.id} />
              <textarea name="note" placeholder="Decision note" />
              <div className="form-row">
                <button className="button" name="decision" value="APPROVE" type="submit">
                  Approve
                </button>
                <button className="button danger" name="decision" value="REJECT" type="submit">
                  Reject
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>
      {reviews.length === 0 ? (
        <section className="panel">
          <p>No pending high-risk reviews.</p>
        </section>
      ) : null}
    </main>
  );
}
