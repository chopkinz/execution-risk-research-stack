import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";

export default function AboutPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">About</h1>
        <p className="mt-1 text-sm text-slate-600">Professional profile focused on execution-aware research infrastructure.</p>
      </header>

      <Panel title="Profile" subtitle="Engineering focus and operating principles">
        <div className="space-y-3 text-sm leading-6 text-slate-700">
          <p>
            Meridian Terminal is built to reflect institutional engineering standards: deterministic data workflows, explicit risk
            controls, execution-aware simulation, and reproducible outputs that can be inspected across environments.
          </p>
          <p>
            The core approach is to separate compute from presentation. Python handles strategy, risk, and execution research while
            the frontend provides clean operational visibility for markets and artifacts.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">Execution-aware systems</Badge>
            <Badge tone="gray">Deterministic pipelines</Badge>
            <Badge tone="gray">Risk governance</Badge>
            <Badge tone="gray">Reproducibility</Badge>
          </div>
        </div>
      </Panel>

      <Panel title="Links" subtitle="External profile and documents">
        <div className="flex flex-wrap gap-3">
          <Button href="https://github.com/chopkinz" variant="secondary">
            GitHub
          </Button>
          <Button href="https://www.linkedin.com/in/chase-hopkins4" variant="secondary">
            LinkedIn
          </Button>
          <Button href="/resume.pdf">Resume</Button>
        </div>
      </Panel>
    </div>
  );
}
