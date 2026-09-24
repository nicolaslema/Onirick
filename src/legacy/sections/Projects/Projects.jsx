import ProjectCard from './ProjectCard';
import './Projects.css';

// Placeholder data — swap in the real projects.
const PROJECTS = [
  {
    title: 'Project One',
    blurb: 'A short one-line description of what this project does.',
    tags: ['React', 'Node']
  },
  {
    title: 'Project Two',
    blurb: 'A short one-line description of what this project does.',
    tags: ['TypeScript', 'GraphQL']
  },
  {
    title: 'Project Three',
    blurb: 'A short one-line description of what this project does.',
    tags: ['Three.js', 'WebGL']
  },
  {
    title: 'Project Four',
    blurb: 'A short one-line description of what this project does.',
    tags: ['Vite', 'CSS']
  }
];

const Projects = () => {
  return (
    <section className="portfolio-projects">
      <h2 className="portfolio-projects-title">Projects</h2>
      <div className="portfolio-projects-grid">
        {PROJECTS.map(project => (
          <ProjectCard key={project.title} {...project} />
        ))}
      </div>
    </section>
  );
};

export default Projects;
