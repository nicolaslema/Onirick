import './Process.css';

const STEPS = [
  {
    n: '01',
    title: 'Pick an element',
    desc: 'Point eddy at whatever should react — a hero image, a card, a whole section.'
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
  <section className="eddy-process">
    <h2 className="eddy-process-title">How it gets on your page.</h2>
    <ol className="eddy-process-steps">
      {STEPS.map(s => (
        <li className="eddy-process-step" key={s.n}>
          <span className="eddy-process-n">{s.n}</span>
          <h3 className="eddy-process-step-title">{s.title}</h3>
          <p className="eddy-process-step-desc">{s.desc}</p>
        </li>
      ))}
    </ol>
  </section>
);

export default Process;
