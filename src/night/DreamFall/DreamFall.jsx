import DreamPlaceholder from '../DreamPlaceholder';

// Phase 0: placeholder. Phase 5 replaces this with the infinite-fall
// particle scene (see PLAN.md 6.6).
const DreamFall = () => (
  <DreamPlaceholder
    tint="fall"
    tape={5}
    time="06:41 AM"
    stage="REM 4"
    title="The Fall"
    log="There's no ground yet. The clouds go past in the wrong direction. You're not falling so much as being let go of. Somewhere below, an alarm is starting."
  />
);

export default DreamFall;
