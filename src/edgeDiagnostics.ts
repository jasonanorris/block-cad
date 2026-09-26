export class EdgeBuildError extends Error {
  constructor(message: string, public edgeKeys: string[] = []) { super(message); this.name = 'EdgeBuildError' }
}
