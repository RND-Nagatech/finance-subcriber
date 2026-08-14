const argv = process.argv.slice(2);

export const getArgValue = (name: string): string | undefined => {
  const prefix = `${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = argv.indexOf(name);
  if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1];
  }

  return undefined;
};

export const sourceSuffix = () => getArgValue('--source-suffix') ?? process.env.PATCH_SOURCE_SUFFIX ?? '2';

export const targetSuffix = () => getArgValue('--target-suffix') ?? process.env.PATCH_TARGET_SUFFIX ?? '';

export const sourceCollection = (baseName: string) => getArgValue(`--source-${baseName}`)
  ?? getArgValue('--source-collection')
  ?? `${baseName}${sourceSuffix()}`;

export const targetCollection = (baseName: string) => getArgValue(`--target-${baseName}`)
  ?? getArgValue('--target-collection')
  ?? `${baseName}${targetSuffix()}`;

