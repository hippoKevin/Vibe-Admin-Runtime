import { Injectable } from '@nestjs/common';

@Injectable()
export class ToolService {
  /**
   * 扁平数组 转 树形结构（通用方法）
   */
  buildTree<T>(
    list: T[],
    parentIdField = 'parent_id',
    rootValue: any = 0,
    primaryKey = 'id',
    sortField = 'menu_sort', 
  ) {
    // 1. 先按 sortField 排序
    const sortedList = [...list].sort((a, b) => {
      return (a[sortField] ?? 0) - (b[sortField] ?? 0);
    });
  
    // 2. 构建映射
    const map = new Map();
    sortedList.forEach(item => {
      map.set(item[primaryKey], { ...item, children: [] });
    });
  
    // 3. 组装树
    const tree: T[] = [];
    sortedList.forEach(item => {
      const parentId = item[parentIdField];
      if (parentId === rootValue) {
        tree.push(map.get(item[primaryKey]));
      } else {
        const parent = map.get(parentId);
        if (parent) {
          parent.children.push(map.get(item[primaryKey]));
        }
      }
    });
  
    return tree;
  }
}