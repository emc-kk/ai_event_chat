export type IAiWord = {
  id: number;
  title: string;
  description: string;
  category: string;
}

export class AiWordImple implements IAiWord {
  private _id: number;
  private _title: string;
  private _description: string;
  private _category: string;

  constructor(data: IAiWord) {
    this._id = data.id;
    this._title = data.title;
    this._description = data.description;
    this._category = data.category;
  }

  get id() {
    return this._id;
  }

  get title() {
    return this._title;
  }

  get description() {
    return this._description;
  }

  get category() {
    return this._category;
  }
}
