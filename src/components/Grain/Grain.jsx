import './Grain.css';

// Film grain over the whole page (PLAN.md 4.4): a tiled noise PNG, overlay
// blend, 7% — fixed above the sections and the melt canvas so it's never
// captured or melted, below the HUD.
const Grain = () => <div className="onk-grain" aria-hidden="true" />;

export default Grain;
