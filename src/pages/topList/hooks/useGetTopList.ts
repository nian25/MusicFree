import { RequestStateCode } from "@/constants/commonConst";
import PluginManager from "@/core/pluginManager";
import { produce } from "immer";
import { useAtom } from "jotai";
import { useCallback } from "react";
import { pluginsTopListAtom } from "../store/atoms";

export default function useGetTopList() {
    const [pluginsTopList, setPluginsTopList] = useAtom(pluginsTopListAtom);

    const getTopList = useCallback(
        async (pluginHash: string, forceRefresh = false) => {
            try {
                // 如果不是强制刷新，且已有数据/加载中直接返回
                if (
                    !forceRefresh &&
                    (pluginsTopList[pluginHash]?.data?.length ||
                    pluginsTopList[pluginHash]?.state ===
                        RequestStateCode.PENDING_REST_PAGE)
                ) {
                    return;
                }
                // 获取plugin
                const plugin = PluginManager.getByHash(pluginHash);
                if (!plugin) {
                    return;
                }

                setPluginsTopList(
                    produce(draft => {
                        draft[pluginHash] = {
                            state: RequestStateCode.PENDING_REST_PAGE,
                            data: [],
                        };
                    }),
                );
                const result = await plugin?.methods?.getTopLists();
                setPluginsTopList(
                    produce(draft => {
                        draft[pluginHash] = {
                            data: result,
                            state: RequestStateCode.FINISHED,
                        };
                    }),
                );
            } catch (e) {
                console.error("Error fetching top list:", e);
                setPluginsTopList(
                    produce(draft => {
                        draft[pluginHash].state = RequestStateCode.ERROR;
                    }),
                );
            }
        },
        [pluginsTopList],
    );

    return getTopList;
}