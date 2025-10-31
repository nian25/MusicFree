import "react-native-get-random-values";

import { getCurrentDialog, showDialog } from "@/components/dialogs/useDialog.ts";
import { ImgAsset } from "@/constants/assetsConst";
import { emptyFunction, localPluginHash, supportLocalMediaType } from "@/constants/commonConst";
import pathConst from "@/constants/pathConst";
import Config from "@/core/appConfig";
import downloader, { DownloadFailReason, DownloaderEvent, DownloadStatus } from "@/core/downloader";
import LocalMusicSheet from "@/core/localMusicSheet";
import lyricManager from "@/core/lyricManager";
import musicHistory from "@/core/musicHistory";
import MusicSheet from "@/core/musicSheet";
import PluginManager from "@/core/pluginManager";
import Theme from "@/core/theme";
import TrackPlayer from "@/core/trackPlayer";
import NativeUtils from "@/native/utils";
import { checkAndCreateDir } from "@/utils/fileUtils";
import { errorLog, trace } from "@/utils/log";
import { IPerfLogger, perfLogger } from "@/utils/perfLogger";
import PersistStatus from "@/utils/persistStatus";
import Toast from "@/utils/toast";
import * as SplashScreen from "expo-splash-screen";
import {  Linking, Platform } from "react-native";
import { PERMISSIONS, check, request } from "react-native-permissions";
import RNTrackPlayer, { AppKilledPlaybackBehavior, Capability } from "react-native-track-player";
import i18n from "@/core/i18n";
import bootstrapAtom from "./bootstrap.atom";
import { getDefaultStore } from "jotai";


// 依赖管理
PluginManager.injectDependencies(Config);
musicHistory.injectDependencies(Config);
TrackPlayer.injectDependencies(Config, musicHistory, PluginManager);
downloader.injectDependencies(Config, PluginManager);
lyricManager.injectDependencies(TrackPlayer, Config, PluginManager);
MusicSheet.injectDependencies(Config);


async function bootstrapImpl() {
    await SplashScreen.preventAutoHideAsync()
        .then(result =>
            console.log(
                `SplashScreen.preventAutoHideAsync() succeeded: ${result}`,
            ),
        )
        .catch(console.warn); // it's good to explicitly catch and inspect any error
    const logger = perfLogger();
    // 1. 检查权限
    if (Platform.OS === "android" && Platform.Version >= 30) {
        const hasPermission = await NativeUtils.checkStoragePermission();
        if (
            !hasPermission &&
            !PersistStatus.get("app.skipBootstrapStorageDialog")
        ) {
            showDialog("CheckStorage");
        }
    } else {
        const [readStoragePermission, writeStoragePermission] =
            await Promise.all([
                check(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE),
                check(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE),
            ]);
        if (
            !(
                readStoragePermission === "granted" &&
                writeStoragePermission === "granted"
            )
        ) {
            await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
            await request(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
        }
    }
    logger.mark("权限检查完成");

    // 2. 数据初始化
    /** 初始化路径 */
    await setupFolder();
    trace("文件夹初始化完成");
    logger.mark("文件夹初始化完成");



    // 加载配置
    await Promise.all([
        Config.setup().then(() => {
            // 设置默认主题为跟随系统
            if (Config.getConfig("theme.followSystem") === undefined) {
                Config.setConfig("theme.followSystem", true);
            }
            logger.mark("Config");
        }),
        MusicSheet.setup().then(() => {
            logger.mark("MusicSheet");
        }),
        musicHistory.setup().then(() => {
            logger.mark("musicHistory");
        }),
    ]);
    trace("配置初始化完成");
    logger.mark("配置初始化完成");

    // 加载插件
    await PluginManager.setup();
    logger.mark("插件初始化完成");
    trace("插件初始化完成");

    await initTrackPlayer(logger).catch(err => {
        // 初始化播放器出错，延迟初始化
        const bootstrapState = getDefaultStore().get(bootstrapAtom);

        if (bootstrapState.state === "Loading") {
            getDefaultStore().set(bootstrapAtom, {
                state: "TrackPlayerError",
                reason: err,
            });
        }
    });

    await LocalMusicSheet.setup();
    trace("本地音乐初始化完成");
    logger.mark("本地音乐初始化完成");

    Theme.setup();
    trace("主题初始化完成");
    logger.mark("主题初始化完成");

    extraMakeup();

    i18n.setup();
    logger.mark("语言模块初始化完成");
    
    ErrorUtils.setGlobalHandler(error => {
        errorLog("未捕获的错误", error);
    });
}

/** 初始化 */
async function setupFolder() {
    await Promise.all([
        checkAndCreateDir(pathConst.dataPath),
        checkAndCreateDir(pathConst.logPath),
        checkAndCreateDir(pathConst.cachePath),
        checkAndCreateDir(pathConst.pluginPath),
        checkAndCreateDir(pathConst.lrcCachePath),
        checkAndCreateDir(pathConst.downloadCachePath),
        checkAndCreateDir(pathConst.localLrcPath),
        checkAndCreateDir(pathConst.downloadPath).then(() => {
            checkAndCreateDir(pathConst.downloadMusicPath);
        }),
    ]);
}

export async function initTrackPlayer(logger?: IPerfLogger) {
    try {
        await RNTrackPlayer.setupPlayer({
            maxCacheSize:
                Config.getConfig("basic.maxCacheSize") ?? 1024 * 1024 * 512,
        });
    } catch (e: any) {
        if (
            e?.message !==
            "The player has already been initialized via setupPlayer."
        ) {
            throw e;
        }
    }
    logger?.mark("加载播放器");

    const capabilities = Config.getConfig("basic.showExitOnNotification")
        ? [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.Stop,
        ]
        : [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
        ];
    await RNTrackPlayer.updateOptions({
        icon: ImgAsset.logoTransparent,
        progressUpdateEventInterval: 1,
        android: {
            alwaysPauseOnInterruption: true,
            appKilledPlaybackBehavior:
                AppKilledPlaybackBehavior.ContinuePlayback,
        },
        capabilities: capabilities,
        compactCapabilities: capabilities,
        notificationCapabilities: [...capabilities, Capability.SeekTo],
    });
    logger?.mark("播放器初始化完成");
    trace("播放器初始化完成");

    await TrackPlayer.setupTrackPlayer();
    trace("播放列表初始化完成");
    logger?.mark("播放列表初始化完成");

    await lyricManager.setup();

    logger?.mark("歌词初始化完成");
}


/** 不需要阻塞的 */
async function extraMakeup() {
    // 自动更新
    try {
        if (Config.getConfig("basic.autoUpdatePlugin")) {
            const lastUpdated = PersistStatus.get("app.pluginUpdateTime") || 0;
            const now = Date.now();
            if (Math.abs(now - lastUpdated) > 86400000) {
                PersistStatus.set("app.pluginUpdateTime", now);
                const plugins = PluginManager.getEnabledPlugins();
                
                // 顺序更新插件而不是并行更新，确保状态正确更新
                for (let i = 0; i < plugins.length; ++i) {
                    const srcUrl = plugins[i].instance.srcUrl;
                    if (srcUrl) {
                        // 静默失败
                        try {
                            await PluginManager.installPluginFromUrl(srcUrl);
                        } catch (e) {
                            console.error("插件更新失败:", srcUrl, e);
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("自动更新插件出错:", e);
    }
}


function bindEvents() {
    // 保存最后一次尝试下载的项目
    let lastDownloadItems: IMusic.IMusicItem | IMusic.IMusicItem[] | null = null;
    let lastDownloadQuality: IMusic.IQualityKey | undefined = undefined;

    // 下载事件
    downloader.on(DownloaderEvent.DownloadError, (reason) => {
        if (reason === DownloadFailReason.NetworkOffline) {
            Toast.warn("当前无网络连接，请等待网络恢复后重试");
        } else if (reason === DownloadFailReason.NotAllowToDownloadInCellular) {
            if (getCurrentDialog()?.name !== "SimpleDialog") {
                showDialog("SimpleDialog", {
                    title: "流量提醒",
                    content: "当前非WIFI环境，是否开启移动网络下载？",
                    okText: "开启",
                    cancelText: "取消",
                    onOk: () => {
                        // 开启移动网络下载功能
                        Config.setConfig("basic.useCelluarNetworkDownload", true);
                        // 重新尝试下载
                        if (lastDownloadItems) {
                            downloader.retryDownload(lastDownloadItems, lastDownloadQuality);
                        }
                    }
                });
            }
        }
    });

    // 保存下载请求的信息
    downloader.on(DownloaderEvent.DownloadTaskUpdate, (task) => {
        if (task.status === DownloadStatus.Pending) {
            lastDownloadItems = task.musicItem;
            lastDownloadQuality = task.quality;
        }
    });

    downloader.on(DownloaderEvent.DownloadQueueCompleted, () => {
        Toast.success("下载任务已完成");
    });
}

export default async function () {
    try {
        getDefaultStore().set(bootstrapAtom, {
            "state": "Loading",
        });
        await bootstrapImpl();
        bindEvents();
        getDefaultStore().set(bootstrapAtom, {
            "state": "Done",
        });
    } catch (e: any) {
        errorLog("初始化出错", e);
        if (getDefaultStore().get(bootstrapAtom).state === "Loading") {
            getDefaultStore().set(bootstrapAtom, {
                state: "Fatal",
                reason: e,
            });
        }
    }
    // 隐藏开屏动画
    console.log("HIDE");
    await SplashScreen.hideAsync();
}