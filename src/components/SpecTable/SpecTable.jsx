import Reveal from '../Reveal/Reveal';

// The manual's spec sheet (styled by .onk-spec in components.css): a label,
// a big mono value and an optional small note per row, each row revealed
// on its own as it scrolls in.
const SpecTable = ({ rows }) => (
  <table className="onk-spec">
    <tbody>
      {rows.map(row => (
        <Reveal as="tr" key={row.label}>
          <th scope="row">{row.label}</th>
          <td>
            {row.value}
            {row.note && <small>{row.note}</small>}
          </td>
        </Reveal>
      ))}
    </tbody>
  </table>
);

export default SpecTable;
