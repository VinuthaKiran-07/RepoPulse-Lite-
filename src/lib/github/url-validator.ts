export type UrlValidationResult =
  | { ok: true; owner: string; repo: string; normalizedUrl: string }
  | { ok: false; reason: string };

const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

function fail(reason: string): UrlValidationResult {
  return { ok: false, reason };
}

function checkName(name: string, isOwner: boolean): string | null {
  if (!NAME_PATTERN.test(name)) {
    return "owner and repository names may only contain letters, numbers, periods, hyphens, and underscores";
  }
  if (name.startsWith("-") || name.startsWith(".")) {
    return "owner and repository names cannot begin with a hyphen or period";
  }
  if (isOwner && name.endsWith("-")) {
    return "owner name cannot end with a hyphen";
  }
  if (name.endsWith(".")) {
    return "owner and repository names cannot end with a period";
  }
  if (name.includes("..")) {
    return "owner and repository names cannot contain consecutive periods";
  }
  if (isOwner && name.length > 39) {
    return "owner name exceeds the maximum length of 39 characters";
  }
  if (!isOwner && name.length > 100) {
    return "repository name exceeds the maximum length of 100 characters";
  }
  return null;
}

export function validateGithubUrl(input: unknown): UrlValidationResult {
  if (typeof input !== "string") {
    return fail("input must be a string containing a GitHub repository URL");
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return fail("URL cannot be empty");
  }

  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code < 33 || code > 126) {
      return fail("URL contains unsupported characters");
    }
  }

  if (trimmed.includes("%")) {
    return fail("percent-encoded characters are not allowed in the URL");
  }

  if (trimmed.includes("@")) {
    return fail("URLs with embedded credentials are not allowed");
  }

  if (trimmed.includes("#")) {
    return fail("URL fragments are not allowed");
  }

  if (!/^https:\/\//i.test(trimmed)) {
    return fail("only https:// URLs are allowed");
  }

  const withoutScheme = trimmed.slice(8);
  const queryIndex = withoutScheme.indexOf("?");
  const pathPart =
    queryIndex === -1 ? withoutScheme : withoutScheme.slice(0, queryIndex);

  if (pathPart.includes(":")) {
    return fail("URLs with a port are not allowed");
  }

  const segments = pathPart.split("/");
  if (segments[0].toLowerCase() !== "github.com") {
    return fail("host must be github.com");
  }

  let hadTrailingSlash = false;
  if (segments[segments.length - 1] === "") {
    segments.pop();
    hadTrailingSlash = true;
  }

  for (let i = 1; i < segments.length; i++) {
    if (segments[i] === "") {
      return fail("URL contains an empty owner or repository name");
    }
  }

  if (segments.length > 3) {
    return fail(
      "extra path segments not allowed — use the bare repository URL"
    );
  }

  if (segments.length < 3) {
    return fail(
      "URL must include both an owner and a repository name, like https://github.com/{owner}/{repo}"
    );
  }

  const owner = segments[1];
  let repo = segments[2];

  if (repo.endsWith(".git")) {
    if (hadTrailingSlash) {
      return fail(
        "URL format not supported — use https://github.com/{owner}/{repo}"
      );
    }
    repo = repo.slice(0, -4);
    if (repo === "") {
      return fail("repository name cannot be empty");
    }
  }

  const ownerError = checkName(owner, true);
  if (ownerError !== null) {
    return fail(ownerError);
  }

  const repoError = checkName(repo, false);
  if (repoError !== null) {
    return fail(repoError);
  }

  return {
    ok: true,
    owner,
    repo,
    normalizedUrl: `https://github.com/${owner}/${repo}`,
  };
}
