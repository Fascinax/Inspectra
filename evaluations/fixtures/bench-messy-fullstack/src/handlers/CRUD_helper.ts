// CRUD helpers — mixed naming conventions
// TODO: refactor this entire file
// FIXME: naming is inconsistent
// TODO: add proper types instead of any

export function GetAllItems(collection: any[]): any[] {
  return collection;
}

export function get_item_by_id(collection: any[], id: number): any {
  return collection.find((item: any) => item.id === id);
}

export function createNewItem(collection: any[], item: any): any {
  collection.push(item);
  return item;
}

export function DELETE_ITEM(collection: any[], id: number): boolean {
  const idx = collection.findIndex((item: any) => item.id === id);
  if (idx >= 0) {
    collection.splice(idx, 1);
    return true;
  }
  return false;
}

export function update_Item(collection: any[], id: number, data: any): any {
  const idx = collection.findIndex((item: any) => item.id === id);
  if (idx >= 0) {
    collection[idx] = { ...collection[idx], ...data };
    return collection[idx];
  }
  return null;
}

export function CountItems(collection: any[]): number {
  return collection.length;
}

export function FILTER_BY_STATUS(collection: any[], status: string): any[] {
  return collection.filter((item: any) => item.status === status);
}

export function sortByDate(collection: any[]): any[] {
  return [...collection].sort((a: any, b: any) => b.createdAt - a.createdAt);
}
