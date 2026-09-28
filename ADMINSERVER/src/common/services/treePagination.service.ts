/**
 * ========================
 * 树结构
 * 1. 需要实现的要求
 * 1.1 获取传入的searchForm, 以及需要查询的数据表
 * 1.2 设置数据树结构
 * 1.3 先通过searchForm中的ep里的内容，查询数据表数据，数据需要通过树型结构，从子级往上层搜索，若子级拥有则不查询父级，若子级没有则查询父级
 * 1.4 分页数据，只留存根据pageSize以及pageNumber查询的根目录数据
 * ========================
 */

import { Injectable } from "@nestjs/common";
import { SearchForm, PaginatedResult } from "../types/pagination.types";
import { ToolService } from "./tools.service";

@Injectable()
export class TreePaginatedQuery {
  constructor(
    private readonly toolService: ToolService,
  ) {}

  /**
   * 树形分页查询（支持建树前自定义数据加工）
   * @param fetchDataFunc   获取全量扁平数据
   * @param searchForm      查询条件（ep + 分页）
   * @param transformFunc   【可选】过滤后的扁平列表交给调用方加工（如挂载子关联数据），返回加工后的列表
   * @param parentIdField   父ID字段，默认 parent_id
   * @param rootValue       根节点标识值，默认 0
   * @param primaryKey      主键字段，默认 id
   */
  async queryWithTransform<T = any>(
    fetchDataFunc: () => Promise<T[]>,
    searchForm: SearchForm,
    transformFunc: ((filteredList: T[]) => Promise<T[]>) | null = null,
    parentIdField = "parent_id",
    rootValue: number | null = 0,
    primaryKey = "id",
  ): Promise<PaginatedResult<T>> {
    const pageNumber = searchForm?.paging?.pageNumber || 1;
    const pageSize = searchForm?.paging?.pageSize || 10;
    const ep = searchForm?.ep || {};

    // 1. 获取全量扁平数据
    let fullList = await fetchDataFunc();
    if (!fullList || fullList.length === 0) {
      return this.createEmptyPage(pageNumber, pageSize);
    }

    // 1.5 软删除过滤：如果数据里存在 is_deleted 字段，默认剔除已删除的节点。
    // 由于这里的数据来源是调用方自定义的 fetchDataFunc（可能来自任意实体），
    // 没有 Repository.metadata 可用，所以改成在运行时检查数据本身是否带有该字段。
    // 调用方如果在 ep 里显式传了 is_deleted（比如做"回收站"查询），则尊重调用方意图，不做默认过滤。
    const callerSpecifiedIsDeleted = ep?.is_deleted !== undefined && ep?.is_deleted !== null && ep?.is_deleted !== "";
    const hasIsDeletedField = fullList.some(item => item != null && typeof item === "object" && "is_deleted" in item);

    if (hasIsDeletedField && !callerSpecifiedIsDeleted) {
      // 只保留未删除的节点。注意：父节点被删除后，其所有子孙节点也一并从树里剔除，
      // 避免出现"父节点不存在，但子节点还挂在树里"的断链情况。
      fullList = this.filterOutDeletedSubtrees(fullList, parentIdField, primaryKey);
    }

    if (fullList.length === 0) {
      return this.createEmptyPage(pageNumber, pageSize);
    }

    // 2. 构建节点映射
    const itemMap = new Map<any, T>();
    fullList.forEach(item => itemMap.set(item[primaryKey], item));

    // 3. 根据 ep 过滤，收集匹配节点 + 祖先链
    const hasEpCondition = Object.keys(ep).some(
      k => k !== "is_deleted" && ep[k] !== undefined && ep[k] !== null && ep[k] !== ""
    );

    const ancestorIds = new Set<any>();

    if (!hasEpCondition) {
      // ep 无条件 → 保留全量（已经是排除了已删除节点之后的全量）
      fullList.forEach(item => ancestorIds.add(item[primaryKey]));
    } else {
      const matchedItems = fullList.filter(item => this.matchEp(item, ep));
      if (matchedItems.length === 0) {
        return this.createEmptyPage(pageNumber, pageSize);
      }
      // 从每个匹配节点向上回溯，收集完整祖先链（父节点仅作路径保留）
      matchedItems.forEach(item =>
        this.collectAncestors(item[primaryKey], itemMap, ancestorIds, parentIdField, primaryKey)
      );
    }

    // 4. 过滤出符合条件的扁平列表
    let filteredList = fullList.filter(item => ancestorIds.has(item[primaryKey]));

    // 5. 【调用方介入点】建树前对扁平列表做额外加工（如挂载 operationChildren）
    if (transformFunc) {
      filteredList = await transformFunc(filteredList);
    }

    // 6. 用加工后的列表构建树
    const filteredTree = this.toolService.buildTree(
      filteredList,
      parentIdField,
      rootValue,
      primaryKey,
    );

    // 7. 根节点分页
    const totalNum = filteredTree.length;
    const start = (pageNumber - 1) * pageSize;
    const paginatedRoots = filteredTree.slice(start, start + pageSize);

    return {
      data: paginatedRoots,
      total: totalNum,
      pageNumber,
      pageSize,
    };
  }

  // ------------------------------ 工具方法 ------------------------------

  // 匹配ep条件（排除 is_deleted，因为它已经在软删除过滤阶段单独处理过了）
  private matchEp<T>(item: T, ep: Record<string, any>): boolean {
    for (const key in ep) {
      if (!Object.prototype.hasOwnProperty.call(ep, key)) continue;
      if (key === "is_deleted") continue;
      const value = ep[key];
      if (value === undefined || value === null || value === "") continue;
      if (!String(item[key]).includes(String(value))) return false;
    }
    return true;
  }

  /**
   * 剔除已删除节点及其所有子孙节点
   * 逻辑：先标记出所有 is_deleted = true 的节点ID，
   * 再递归标记它们的所有子孙节点也视为"应剔除"，
   * 最后只保留完全不在剔除集合中的节点。
   */
  private filterOutDeletedSubtrees<T>(
    fullList: T[],
    parentIdField: string,
    primaryKey: string,
  ): T[] {
    const deletedRootIds = new Set<any>();
    fullList.forEach(item => {
      if ((item as any).is_deleted) {
        deletedRootIds.add(item[primaryKey]);
      }
    });

    if (deletedRootIds.size === 0) {
      return fullList;
    }

    // 构建 parent_id -> children[] 的映射，方便向下查找子孙节点
    const childrenMap = new Map<any, T[]>();
    fullList.forEach(item => {
      const pid = item[parentIdField];
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid).push(item);
    });

    const excludedIds = new Set<any>(deletedRootIds);

    // 从每个已删除节点出发，递归标记其所有子孙也应剔除
    const markDescendants = (id: any) => {
      const children = childrenMap.get(id) || [];
      children.forEach(child => {
        const childId = child[primaryKey];
        if (!excludedIds.has(childId)) {
          excludedIds.add(childId);
          markDescendants(childId);
        }
      });
    };
    deletedRootIds.forEach(id => markDescendants(id));

    return fullList.filter(item => !excludedIds.has(item[primaryKey]));
  }

  // 递归收集祖先链
  private collectAncestors<T>(
    id: any,
    itemMap: Map<any, T>,
    ancestorIds: Set<any>,
    parentIdField: string,
    primaryKey: string,
  ): void {
    if (!id || ancestorIds.has(id)) return;
    const item = itemMap.get(id);
    if (!item) return;
    ancestorIds.add(id);
    this.collectAncestors(item[parentIdField], itemMap, ancestorIds, parentIdField, primaryKey);
  }

  // 创建空数据
  private createEmptyPage(pageNumber: number, pageSize: number): PaginatedResult<any> {
    return { data: [], total: 0, pageNumber, pageSize };
  }
}