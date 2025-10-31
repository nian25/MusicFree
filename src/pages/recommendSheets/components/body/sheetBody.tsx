import React, { memo, useMemo, useState, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import globalStyle from "@/constants/globalStyle";
import { ScrollView } from "react-native-gesture-handler";
import TypeTag from "../../../../components/base/typeTag";

import useRecommendList from "../../hooks/useRecommendListTags";
import SheetList from "./sheetList";
import { hidePanel, showPanel } from "@/components/panels/usePanel";
import { useI18N } from "@/core/i18n";

interface IProps {
    hash: string;
}

function SheetBody(props: IProps) {
    const { hash } = props;

    const { t } = useI18N();

    const defaultTag: ICommon.IUnique = useMemo(() => ({
        title: t("common.default"),
        id: "",
    }), [t]);

    // 选中的tag
    const [selectedTag, setSelectedTag] = useState<ICommon.IUnique>(defaultTag);

    // 第一个tag
    const [firstTag, setFirstTag] = useState<ICommon.IUnique>(defaultTag);

    // 添加强制刷新状态
    const [forceRefresh, setForceRefresh] = useState(false);
    
    // 所有tag
    const tags = useRecommendList(hash, forceRefresh);
    
    // 刷新函数
    const handleRefresh = useCallback(() => {
        setForceRefresh(prev => !prev);
    }, []);

    // 检查是否只有默认标签（即加载失败的情况）
    const hasOnlyDefaultTag = !tags || !tags.pinned || tags.pinned.length === 0;

    return (
        <View style={globalStyle.fwflex1}>
            <ScrollView
                style={style.headerWrapper}
                contentContainerStyle={style.header}
                showsHorizontalScrollIndicator={false}
                horizontal>
                <TypeTag
                    title={firstTag.title}
                    selected={selectedTag.id === firstTag.id}
                    onPress={() => {
                        // 拉起浮层
                        showPanel("SheetTags", {
                            tags: tags?.data ?? [],
                            onTagPressed(tag) {
                                setSelectedTag(tag);
                                setFirstTag(tag);
                                hidePanel();
                            },
                        });
                    }}
                />
                {(tags?.pinned ?? []).map(_ => (
                    <TypeTag
                        key={`pinned-${_.id}`}
                        title={_?.title ?? ""}
                        selected={selectedTag.id === _.id}
                        onPress={() => {
                            setSelectedTag(_);
                        }}
                    />
                ))}
            </ScrollView>
            <SheetList 
                tag={selectedTag} 
                pluginHash={hash} 
                onRefresh={handleRefresh}
                hasOnlyDefaultTag={hasOnlyDefaultTag}
            />
        </View>
    );
}

export default memo(SheetBody, (prev, curr) => prev.hash === curr.hash);

const style = StyleSheet.create({
    headerWrapper: {
        height: rpx(100),
        flexGrow: 0,
    },
    header: {
        height: rpx(100),
        alignItems: "center",
    },
});