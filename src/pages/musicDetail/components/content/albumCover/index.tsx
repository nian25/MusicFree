import React, { useMemo } from "react";
import rpx from "@/utils/rpx";
import { ImgAsset } from "@/constants/assetsConst";
import FastImage from "@/components/base/fastImage";
import useOrientation from "@/hooks/useOrientation";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useCurrentMusic } from "@/core/trackPlayer";
import globalStyle from "@/constants/globalStyle";
import { View, Text, StyleSheet } from "react-native";
import Operations from "./operations";
import { showPanel } from "@/components/panels/usePanel.ts";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";
import Tag from "@/components/base/tag";

interface IProps {
    onTurnPageClick?: () => void;
}

export default function AlbumCover(props: IProps) {
    const { onTurnPageClick } = props;

    const musicItem = useCurrentMusic();
    const orientation = useOrientation();
    
    const artworkStyle = useMemo(() => {
        if (orientation === "vertical") {
            return {
                width: rpx(450),
                height: rpx(450),
                borderRadius: rpx(40),
                marginTop: rpx(-200),// 添加这行使封面上移
            };
        } else {
            return {
                width: rpx(260),
                height: rpx(260),
                borderRadius: rpx(20),
                marginTop: rpx(-100),
            };
        }
    }, [orientation]);

    const longPress = Gesture.LongPress()
        .onStart(() => {
            if (musicItem?.artwork) {
                showPanel("ImageViewer", {
                    url: musicItem.artwork,
                });
            }
        })
        .runOnJS(true);

    const tap = Gesture.Tap()
        .onStart(() => {
            onTurnPageClick?.();
        })
        .runOnJS(true);

    const combineGesture = Gesture.Race(tap, longPress);

    return (
        <>
            <GestureDetector gesture={combineGesture}>
                <View style={globalStyle.fullCenter}>
                    <FastImage
                        style={artworkStyle}
                        source={musicItem?.artwork}
                        placeholderSource={ImgAsset.albumDefault}
                    />
                    {orientation === "vertical" && (
                        <View style={styles.musicInfoContainer}>
                            <Text numberOfLines={1} style={styles.musicTitle}>
                                {musicItem?.title ?? "--"}
                            </Text>
                            <Text numberOfLines={1} style={styles.musicArtist}>
                                {musicItem?.artist ?? "--"}
                            </Text>
                            {/* {musicItem?.platform ? (
                        <Tag
                            tagName={musicItem.platform}
                            containerStyle={styles.tagBg}
                            style={styles.tagText}
                        />
                    ) : null} */}
                        </View>
                    )}
                </View>
            </GestureDetector>
            <Operations />
        </>
    );
}

const styles = StyleSheet.create({
    musicInfoContainer: {
        position: "absolute",
        // 调整歌曲信息位置：bottom值控制距离底部的距离
        bottom: rpx(40),  // 歌曲名下移一些（数值减小表示下移）
        left: rpx(50),
        right: rpx(50),
        alignItems: "flex-start",
    },
    musicTitle: {
        color: "white",
        fontSize: fontSizeConst.title_geming,
        fontWeight: fontWeightConst.semibold,
        includeFontPadding: false,
        textAlign: "left",
        marginBottom: rpx(12),
    },
    musicArtist: {
        color: "white",
        fontSize: fontSizeConst.subTitle,
        includeFontPadding: false,
        // marginTop: rpx(10),
        textAlign: "left",
    },
    // tagBg: {
    //     backgroundColor: "rgba(255, 255, 255, 0.2)",
    // },
    // tagText: {
    //     color: "white",
    // },
});