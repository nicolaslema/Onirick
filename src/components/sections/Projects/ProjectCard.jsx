const ProjectCard = ({ title, blurb, tags }) => {
  return (
    <a className="project-card" href="#">
      <div className="project-card-thumb" aria-hidden="true" />
      <h3 className="project-card-title">{title}</h3>
      <p className="project-card-blurb">{blurb}</p>
      <ul className="project-card-tags">
        {tags.map(tag => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
    </a>
  );
};

export default ProjectCard;
