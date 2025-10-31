import React, { memo, useCallback, useState, useEffect } from "react";
import rpx from "@/utils/rpx";
import { FlashList } from "@shopify/flash-list";
import useRecommendSheets from "../../hooks/useRecommendSheets";
import SheetItem from "@/components/mediaItem/sheetItem";
import useOrientation from "@/hooks/useOrientation";
import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";
import { RequestStateCode } from "@/constants/commonConst";

interface ISheetListProps {
    tag: ICommon.IUnique;
    pluginHash: string;
    onRefresh?: () => void;
    hasOnlyDefaultTag?: boolean;
}

function SheetList(props: ISheetListProps) {
    const { tag, pluginHash, onRefresh, hasOnlyDefaultTag } = props ?? {};

    const [forceRefresh, setForceRefresh] = useState(false);
    const [query, sheets, status] = useRecommendSheets(pluginHash, tag, forceRefresh);
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        setForceRefresh(true);
        // 如果只有默认标签，也触发外部刷新回调来重新加载标签
        if (hasOnlyDefaultTag && onRefresh) {
            onRefresh();
        }
    }, [hasOnlyDefaultTag, onRefresh]);

    useEffect(() => {
        if (forceRefresh && status !== RequestStateCode.PENDING_FIRST_PAGE && status !== RequestStateCode.PENDING_REST_PAGE) {
            setRefreshing(false);
            setForceRefresh(false);
        }
    }, [forceRefresh, status]);

    function renderItem({ item }: { item: IMusic.IMusicSheetItemBase }) {
        return <SheetItem sheetInfo={item} pluginHash={pluginHash} />;
    }
    const orientation = useOrientation();

    const keyExtractor = useCallback(
        (item: any, i: number) => `${i}-${item.platform}-${item.id}`,
        [],
    );

    return (
        <FlashList
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={<ListEmpty state={status} onRetry={query} />}
            ListFooterComponent={
                sheets.length ? <ListFooter
                    state={status}
                    onRetry={query}
                /> : null
            }
            onEndReached={() => {
                if (!refreshing) {
                    query();
                }
            }}
            onEndReachedThreshold={0.1}
            estimatedItemSize={rpx(306)}
            numColumns={orientation === "vertical" ? 3 : 4}
            renderItem={renderItem}
            data={sheets}
            keyExtractor={keyExtractor}
        />
    );
}

export default memo(
    SheetList,
    (prev, curr) =>
        prev.tag.id === curr.tag.id && prev.pluginHash === curr.pluginHash,
);