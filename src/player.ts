export default class Player {
  public id: number;
  public pieces: number[];
  public homeCount: number;
  public startPosition: number;

  constructor(id: number, startPosition: number) {
    this.id = id;
    this.pieces = Array(4).fill(-1);
    this.homeCount = 0;
    this.startPosition = startPosition;
  }
}
