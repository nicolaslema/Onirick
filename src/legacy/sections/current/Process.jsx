import './shared.css';
import './Process.css';

const STEPS = [
  {
    n: '01',
    title: 'Pick an element',
    desc: 'Point Current at whatever should react — a hero image, a card, a whole section.'
  },
  {
    n: '02',
    title: 'Choose an effect',
    desc: 'ripple, melt, or drift. Each takes a couple of options: strength, color, how far it should travel.'
  },
  {
    n: '03',
    title: 'Ship it',
    desc: 'One import, no build step, no shader code. Runs at 60fps on anything from the last five years.'
  }
];

const Process = () => (
  <section className="current-process">
    <h2 className="current-process-title">How it gets on your page.</h2>
    <div className="current-process-body">
      <ol className="current-process-steps">
        {STEPS.map(s => (
          <li className="current-process-step" key={s.n}>
            <span className="current-process-n">{s.n}</span>
            <h3 className="current-process-step-title">{s.title}</h3>
            <p className="current-process-step-desc">{s.desc}</p>
          </li>
        ))}
      </ol>
      <div className="current-placeholder current-process-diagram">
        <span className="current-placeholder-label">integration diagram</span>
      </div>
    </div>
  </section>
);

export default Process;
