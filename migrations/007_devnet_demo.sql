ALTER TABLE research_runs DROP CONSTRAINT research_runs_mode_check;
ALTER TABLE research_runs ADD CONSTRAINT research_runs_mode_check CHECK(mode IN ('fixture','local','devnet-demo','live'));
