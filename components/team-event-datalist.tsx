import { TEAM_EVENT_OPTIONS } from "@/lib/taxonomy";

export function TeamEventDatalist({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {TEAM_EVENT_OPTIONS.map(({ name, kind }) => (
        <option key={name} value={name} label={kind} />
      ))}
    </datalist>
  );
}
