import { RequestStateCode } from "@/constants/commonConst";
import PluginManager from "@/core/pluginManager";
import { resetMediaItem } from "@/utils/mediaUtils";
import { useCallback, useEffect, useRef, useState } from "react";

export default function (pluginHash: string, tag: ICommon.IUnique, forceRefresh = false) {
    const [sheets, setSheets] = useState<IMusic.IMusicSheetItemBase[]>([]);
    const [requestState, setRequestState] = useState(RequestStateCode.IDLE);
    const currentTagRef = useRef<string>();
    const pageRef = useRef(0);
    const forceRefreshRef = useRef(forceRefresh);

    const query = useCallback(async (isRefresh = false) => {
        if (
            (requestState === RequestStateCode.FINISHED ||
                requestState === RequestStateCode.PENDING_FIRST_PAGE ||
                requestState === RequestStateCode.PENDING_REST_PAGE) &&
            currentTagRef.current === tag.id &&
            !isRefresh
        ) {
            return;
        }
        try {
            if (currentTagRef.current !== tag.id || isRefresh) {
                setSheets([]);
                pageRef.current = 0;
            }
            pageRef.current++;
            currentTagRef.current = tag.id;
            const plugin = PluginManager.getByHash(pluginHash);
            if (plugin) {
                if (pageRef.current === 1) {
                    setRequestState(RequestStateCode.PENDING_FIRST_PAGE);
                } else {
                    setRequestState(RequestStateCode.PENDING_REST_PAGE);
                }
                const res = await plugin.methods?.getRecommendSheetsByTag?.(
                    tag,
                    pageRef.current,
                );
                
                if (res.isEnd) {
                    setRequestState(RequestStateCode.FINISHED);
                } else {
                    setRequestState(RequestStateCode.PARTLY_DONE);
                }
                if (tag.id === currentTagRef.current) {
                    setSheets(prev => [
                        ...prev,
                        ...res.data!.map(item =>
                            resetMediaItem(item, plugin.instance.platform),
                        ),
                    ]);
                }

            } else {
                setRequestState(RequestStateCode.FINISHED);
                setSheets([]);
            }
        } catch (e) {
            console.error("Error fetching recommend sheets:", e);
            setRequestState(RequestStateCode.ERROR);
        }
    }, [tag, requestState]);

    useEffect(() => {
        forceRefreshRef.current = forceRefresh;
    }, [forceRefresh]);

    useEffect(() => {
        query(forceRefreshRef.current);
    }, [tag, forceRefresh]);


    return [query, sheets, requestState] as const;
}