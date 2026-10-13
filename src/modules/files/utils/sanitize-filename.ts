const MAX_SANITIZED_NAME_LENGTH = 80;

export function sanitizeFilename(name: string): string {
  const withoutSeparators = name.trim().replace(/[/\\]/g, '');
  const withInvalidReplaced = withoutSeparators.replace(
    /[^a-zA-Z0-9._-]/g,
    '-',
  );
  const withoutLeadingDots = withInvalidReplaced.replace(/^\.+/, '');
  return truncatePreservingExtension(withoutLeadingDots);
}

function truncatePreservingExtension(name: string): string {
  if (name.length <= MAX_SANITIZED_NAME_LENGTH) {
    return name;
  }
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex < 0) {
    return name.slice(0, MAX_SANITIZED_NAME_LENGTH);
  }
  const extension = name.slice(lastDotIndex);
  const stemLength = MAX_SANITIZED_NAME_LENGTH - extension.length;
  if (stemLength <= 0) {
    return name.slice(0, MAX_SANITIZED_NAME_LENGTH);
  }
  return name.slice(0, stemLength) + extension;
}
