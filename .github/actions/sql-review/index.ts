import * as core from "@actions/core";
import * as github from "@actions/github";
import * as path from 'path';
import { promises as fs } from "fs";
import * as glob from "glob";

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput("github-token", { required: true });
    const pattern = core.getInput("pattern", { required: true });
    const octokit = github.getOctokit(githubToken);
    const url = core.getInput("url", { required: true });
    const token = core.getInput("token", { required: true });
    const database = core.getInput("database", { required: true });
    const project = core.getInput("project", { required: true });
    const extraHeaders: string = core.getInput("headers");
    const failOnWarnings: boolean = core.getBooleanInput("fail-on-warnings");

    let headers: HeadersInit = extraHeaders ? JSON.parse(extraHeaders) : {};
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    };

    const { owner, repo } = github.context.repo;
    const prNumber = github.context.payload.pull_request?.number;
    if (!prNumber) {
      throw new Error(
        "Could not get PR number from the context; this action should only be run on pull_request events."
      );
    }

    let allChangedFiles: string[] = [];
    let page = 0;
    let fileList;

    // Iterate through all pages of the API response
    do {
      page++;
      fileList = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
        page,
      });

      allChangedFiles.push(...fileList.data.map((file) => file.filename));
    } while (fileList.data.length !== 0);

    // Use glob.sync to synchronously match files against the pattern
    const matchedFiles = glob.sync(pattern, { nodir: true });

    // Filter matchedFiles to include only those that are also in allChangedFiles
    const sqlFiles = matchedFiles.filter((file) =>
      allChangedFiles.includes(file)
    );

    let hasErrorOrWarning = false;

    let files = [];
    const versionReg = /^\d+/
    for (const file of sqlFiles) {
      const filename = path.basename(file)
      const versionM = filename.match(versionReg)
      if (!versionM) {
        core.info(`failed to get version, ignore ${file}`)
        continue
      }
      const version = versionM[0]
      const content = await fs.readFile(file, "utf8");
      files.push({
        name: file,
        statement: content,
        version: version,
        changeType: "DDL",
        type: "VERSIONED",
      });
    }

    const response = await fetch(`${url}/v1/${project}/releases:check`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        release: {
          files: files,
        },
        targets: [database],
      }),
    });

    const httpStatus = response.status;

    if (httpStatus !== 200) {
      throw new Error(
        `Failed to check release with response code ${httpStatus}`
      );
    }

    const responseData = await response.json();

    core.debug("Reviews:" + JSON.stringify(responseData.results));

    for (let i = 0; i < sqlFiles.length; i++) {
      const advices = responseData.results[i].advices;
      const file = sqlFiles[i];

      advices.forEach(
        (advice: {
          status: string;
          line: any;
          column: any;
          title: any;
          code: any;
          content: any;
        }) => {
          const annotation = `::${advice.status} file=${file},line=${advice.line},col=${advice.column},title=${advice.title} (${advice.code})::${advice.content}. https://www.bytebase.com/docs/reference/error-code/advisor#${advice.code}`;
          // Emit annotations for each advice
          core.info(annotation);

          if (
            advice.status === "ERROR" ||
            (failOnWarnings && advice.status === "WARNING")
          ) {
            hasErrorOrWarning = true;
          }
        }
      );
    }

    if (hasErrorOrWarning) {
      core.setFailed(
        "Review contains ERROR or WARNING violations. Marking for failure."
      );
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run();
