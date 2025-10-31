import React, { memo, useState, useCallback, Dispatch, SetStateAction } from "react";
import { SectionList, SectionListProps, StyleSheet, View, RefreshControl } from "react-native";
import rpx from "@/utils/rpx";
import { IPluginTopListResult } from "../store/atoms";
import { RequestStateCode } from "@/constants/commonConst";
import Loading from "@/components/base/loading";
import TopListItem from "@/components/mediaItem/topListItem";
import ThemeText from "@/components/base/themeText";
import ListEmpty from "@/components/base/listEmpty";
import useGetTopList from "../hooks/useGetTopList";

interface IBoardPanelProps {
    hash: string;
    topListData: IPluginTopListResult;
    setForceRefresh?: Dispatch<SetStateAction<boolean>>;
}
function BoardPanel(props: IBoardPanelProps) {
    const { hash, topListData, setForceRefresh } = props ?? {};
    const [refreshing, setRefreshing] = useState(false);
    const getTopList = useGetTopList();

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        if (setForceRefresh) {
            setForceRefresh(true);
        } else {
            // fallback to direct call
            await getTopList(hash, true);
            setRefreshing(false);
        }
    }, [getTopList, hash, setForceRefresh]);

    const renderItem: SectionListProps<IMusic.IMusicSheetItemBase>["renderItem"] =
        ({ item }) => {
            return <TopListItem topListItem={item} pluginHash={hash} />;
        };

    const renderSectionHeader: SectionListProps<IMusic.IMusicSheetItemBase>["renderSectionHeader"] =
        ({ section: { title } }) => {
            return (
                <View style={style.sectionHeader}>
                    <ThemeText fontWeight="bold" fontSize="title">
                        {title}
                    </ThemeText>
                </View>
            );
        };

    // 当数据加载完成时，停止刷新状态
    React.useEffect(() => {
        if (refreshing && topListData?.state === RequestStateCode.FINISHED) {
            setRefreshing(false);
        }
    }, [topListData?.state, refreshing]);

    return topListData?.state !== RequestStateCode.FINISHED && !refreshing ? (
        <Loading />
    ) : (
        <SectionList
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            ListEmptyComponent={<ListEmpty state={topListData?.state} />}
            sections={topListData?.data || []}
        />
    );
}

export default memo(
    BoardPanel,
    (prev, curr) => prev.topListData === curr.topListData,
);

const style = StyleSheet.create({
    wrapper: {
        width: rpx(750),
    },
    sectionHeader: {
        marginTop: rpx(28),
        marginBottom: rpx(24),
        marginLeft: rpx(24),
    },
});