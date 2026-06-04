import type { JobRequirement } from "../jobRequirements";

export function JobRequirementsList({ requirements }: { requirements: JobRequirement[] }) {
  const unmet = requirements.filter((r) => !r.ok);
  if (unmet.length === 0) return null;

  return (
    <div className="job-requirements">
      <dt>Не хватает</dt>
      <dd>
        <ul className="job-requirements-list">
          {unmet.map((req) => (
            <li key={req.label}>
              {req.label}
              {req.status ? (
                <>
                  {" "}
                  <span className="license-miss">{req.status}</span>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}
