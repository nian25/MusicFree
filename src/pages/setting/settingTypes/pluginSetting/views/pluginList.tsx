import React, { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import * as DocumentPicker from "expo-document-picker";
import Loading from "@/components/base/loading";

import PluginManager, { useSortedPlugins } from "@/core/pluginManager";
import { trace } from "@/utils/log";

import Toast from "@/utils/toast";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import Config from "@/core/appConfig";
import Empty from "@/components/base/empty";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import AppBar from "@/components/base/appBar";
import Fab from "@/components/base/fab";
import PluginItem from "../components/pluginItem";
import { IIconName } from "@/components/base/icon.tsx";
import { IInstallPluginResult } from "@/types/core/pluginManager";
import { useI18N } from "@/core/i18n";

interface IOption {
    icon: IIconName;
    title: string;
    onPress?: () => void;
}

export default function PluginList() {
    const plugins = useSortedPlugins();
    const { t } = useI18N();

    const [loading, setLoading] = useState(false);

    const navigator = useNavigation<any>();

    const menuOptions: IOption[] = [
        {
            icon: "bookmark-square",
            title: t("pluginSetting.menu.subscriptionSetting"),
            async onPress() {
                navigator.navigate("/pluginsetting/subscribe");
            },
        },
        {
            icon: "bars-3",
            title: t("pluginSetting.menu.sort"),
            onPress() {
                navigator.navigate("/pluginsetting/sort");
            },
        },
        {
            icon: "trash-outline",
            title: t("pluginSetting.menu.uninstallAll"),
            onPress() {
                showDialog("SimpleDialog", {
                    title: t("pluginSetting.menu.uninstallAll"),
                    content: t("pluginSetting.menu.uninstallAllContent"),
                    async onOk() {
                        setLoading(true);
                        await PluginManager.uninstallAllPlugins();
                        setLoading(false);
                    },
                });
            },
        },
    ];

    async function onInstallFromLocalClick() {
        try {
            const results = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                multiple: true,
                type: ["application/javascript", "text/javascript"],
            });
            if (results.canceled) {
                // 用户取消
                return;
            }
            setLoading(true);

            // 收集所有安装结果
            const installResults: IInstallPluginResult[] = [];
            for (const asset of results.assets) {
                const result = await PluginManager.installPluginFromLocalFile(asset.uri, {
                    notCheckVersion: Config.getConfig(
                        "basic.notCheckPluginVersion",
                    ),
                    useExpoFs: true,
                });
                installResults.push(result);
            }
            
            // 处理安装结果
            handleInstallResults(installResults);
        } catch (e: any) {
            trace("插件安装失败", e?.message);
            Toast.warn(t("toast.installPluginFail", {
                reason: e?.message ?? "",
            }));
        }
        setLoading(false);
    }

    /**
     * 处理插件安装结果
     * @param results 安装结果数组
     */
    function handleInstallResults(results: IInstallPluginResult[]) {
        const successResults = results.filter(result => result.success);
        const failResults = results.filter(result => !result.success && result.message !== "插件已安装" && result.message !== "已安装更新版本的插件");
        const alreadyInstalledResults = results.filter(result => result.message === "插件已安装");
        const newerVersionResults = results.filter(result => result.message === "已安装更新版本的插件");

        if (successResults.length > 0) {
            Toast.success(t("toast.installPluginSuccess"));
        } else if (alreadyInstalledResults.length > 0 && failResults.length === 0 && newerVersionResults.length === 0) {
            Toast.warn(t("toast.installPluginFail", {
                reason: "插件已安装"
            }));
        } else if (newerVersionResults.length > 0 && failResults.length === 0) {
            // 只有版本问题，没有其他失败
            Toast.warn("已安装更新版本的插件，无需安装");
        } else {
            Toast.warn(t("toast.partialPluginInstallFailed"));
        }
    }

    async function onInstallFromNetworkClick() {
        showPanel("SimpleInput", {
            title: t("pluginSetting.menu.installPlugin"),
            placeholder: t("pluginSetting.menu.installPluginDialogPlaceholder"),
            maxLength: 200,
            async onOk(text, closePanel) {
                setLoading(true);
                closePanel();

                const result = await installPluginFromUrl(text.trim());
                handleInstallResults(result);

                setLoading(false);
            },
        });
    }

    async function onSubscribeClick() {
        const urls = Config.getConfig("plugin.subscribeUrl");
        if (!urls) {
            Toast.warn(t("toast.noSubscription"));
            return;
        }
        setLoading(true);

        try {
            const urlItems = JSON.parse(urls!);
            if (Array.isArray(urlItems)) {
                // 收集所有结果
                const allResults: IInstallPluginResult[] = [];
                // 顺序处理订阅插件安装，确保即使某个插件安装失败也不影响其他插件
                for (let i = 0; i < urlItems.length; ++i) {
                    try {
                        const result = await installPluginFromUrl(urlItems[i].url);
                        allResults.push(...result);
                    } catch (e: any) {
                        // 即使单个插件安装失败，也继续处理其他插件
                        console.error("订阅插件安装失败:", urlItems[i].url, e);
                        allResults.push({
                            success: false,
                            message: e?.message ?? "未知错误",
                            pluginUrl: urlItems[i].url
                        });
                    }
                }
                // 批量处理结果
                handleInstallResults(allResults);
            } else {
                throw new Error();
            }
        } catch (e: any) {
            console.error("订阅处理失败:", e);
            if (urls?.length) {
                const result = await installPluginFromUrl(urls);
                handleInstallResults(result);
            }
        }
        setLoading(false);
    }

    async function onUpdateAllClick() {
        const plugins = PluginManager.getEnabledPlugins();
        setLoading(true);

        const allResults: IInstallPluginResult[] = [];

        try {
            for (let i = 0; i < plugins.length; ++i) {
                const srcUrl = plugins[i].instance.srcUrl;
                if (srcUrl) {
                    try {
                        const result = await PluginManager.updatePluginWithResult(plugins[i]);
                        allResults.push(result);
                    } catch (e: any) {
                        // 检查是否是已经是最新版本的错误
                        if (e?.message && (e.message.includes("已是最新版本") || e.message.includes("Already the latest version"))) {
                            allResults.push({
                                success: false,
                                message: e.message,
                                pluginUrl: srcUrl,
                                pluginName: plugins[i].name,
                                pluginHash: plugins[i].hash
                            });
                        } else {
                            allResults.push({
                                success: false,
                                message: e?.message ?? t("toast.failToUpdatePlugin"),
                                pluginUrl: srcUrl,
                                pluginName: plugins[i].name,
                                pluginHash: plugins[i].hash
                            });
                        }
                    }
                }
            }

            // 处理更新结果
            handleUpdateResults(allResults);

        } catch (e: any) {
            Toast.warn(t("toast.unknownError", {
                reason: e?.message ?? e,
            }));
        }
        setLoading(false);
    }

    /**
     * 处理插件更新结果
     * @param results 更新结果数组
     */
    function handleUpdateResults(results: IInstallPluginResult[]) {
        const successResults = results.filter(result => result.success);
        const failResults = results.filter(result => !result.success && 
            !result.message?.includes("已是最新版本") && 
            !result.message?.includes("Already the latest version") &&
            result.message !== "已安装更新版本的插件");
        const alreadyLatestResults = results.filter(result => 
            result.message?.includes("已是最新版本") || 
            result.message?.includes("Already the latest version"));
        const newerVersionResults = results.filter(result => result.message === "已安装更新版本的插件");

        // 根据结果给出相应的提示
        if (!failResults.length && !successResults.length && alreadyLatestResults.length > 0) {
            // 所有插件都是最新版本
            Toast.success(t("checkUpdate.error.latestVersion"));
        } else if (!failResults.length && !newerVersionResults.length) {
            // 所有插件更新成功或已是最新版本
            Toast.success(t("toast.updatePluginSuccess"));
        } else if (!failResults.length && newerVersionResults.length > 0) {
            // 只有版本问题，没有其他失败
            Toast.warn("部分插件已安装更新版本，无需更新");
        } else {
            // 有插件更新失败
            Toast.warn((successResults.length || alreadyLatestResults.length ? t("toast.partialPluginUpdateFailed") : t("toast.allPluginUpdateFailed")), {
                "type": "warn",
                "actionText": t("common.view"),
                "onActionClick": () => {
                    showDialog("SimpleDialog", {
                        title: t("pluginSetting.menu.pluginUpdateFailedDialogTitle"),
                        content: t("pluginSetting.pluginUpdateFailedDialogContent", {
                            detail: failResults.map(it => (it.pluginUrl ?? "") + "\n" + t("pluginSetting.failReason", {
                                reason: it.message ?? "",
                            })).join("\n-----\n"),
                        }),
                    });
                },
            });
        }
    }

    return (
        <>
            <AppBar menu={menuOptions}>{t("sidebar.pluginManagement")}</AppBar>
            <HorizontalSafeAreaView style={style.wrapper}>
                <>
                    {loading ? (
                        <Loading />
                    ) : (
                        <FlatList
                            ListEmptyComponent={Empty}
                            ListFooterComponent={<View style={style.blank} />}
                            data={plugins ?? []}
                            keyExtractor={_ => _.hash}
                            renderItem={({ item: plugin }) => (
                                <PluginItem key={plugin.hash} plugin={plugin} />
                            )}
                        />
                    )}

                    <Fab
                        icon="plus"
                        onPress={() => {
                            showPanel("SimpleSelect", {
                                header: t("pluginSetting.menu.installPlugin"),
                                candidates: [
                                    {
                                        value: "从本地安装插件",
                                        title: t("pluginSetting.fabOptions.installFromLocal"),
                                    },
                                    {
                                        value: "从网络安装插件",
                                        title: t("pluginSetting.fabOptions.installFromNetwork"),
                                    },
                                    {
                                        value: "更新全部插件",
                                        title: t("pluginSetting.fabOptions.updateAllPlugins"),
                                    },
                                    {
                                        value: "更新订阅",
                                        title: t("pluginSetting.fabOptions.updateSubscription"),
                                    },
                                ],
                                onPress(item) {
                                    if (item.value === "从本地安装插件") {
                                        onInstallFromLocalClick();
                                    } else if (
                                        item.value === "从网络安装插件"
                                    ) {
                                        onInstallFromNetworkClick();
                                    } else if (item.value === "更新订阅") {
                                        onSubscribeClick();
                                    } else if (item.value === "更新全部插件") {
                                        onUpdateAllClick();
                                    }
                                },
                            });
                        }}
                    />
                </>
            </HorizontalSafeAreaView>
        </>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    blank: {
        height: rpx(200),
    },
});



async function installPluginFromUrl(text: string): Promise<IInstallPluginResult[]> {
    try {
        let urls: string[] = [];
        const inputUrl = text.trim();
        if (text.endsWith(".json")) {
            const jsonFile = (
                await axios.get(inputUrl, {
                    headers: {
                        "Cache-Control": "no-cache",
                        Pragma: "no-cache",
                        Expires: "0",
                    },
                })
            ).data;
            /**
             * {
             *     plugins: [{
             *          version: xxx,
             *          url: xxx
             *      }]
             * }
             */
            urls = (jsonFile?.plugins ?? []).map((_: any) => _.url);
        } else {
            urls = [inputUrl];
        }
        
        // 收集所有安装结果
        const allResults: IInstallPluginResult[] = [];
        // 顺序安装插件而不是并行安装，确保状态正确更新
        for (const url of urls) {
            try {
                const result = await PluginManager.installPluginFromUrl(url, {
                    notCheckVersion: Config.getConfig(
                        "basic.notCheckPluginVersion",
                    ),
                });
                allResults.push(result);
            } catch (e: any) {
                // 即使单个插件安装失败，也继续处理其他插件
                console.error("插件安装失败:", url, e);
                allResults.push({
                    success: false,
                    message: e?.message ?? "未知错误",
                    pluginUrl: url
                });
            }
        }
        
        return allResults;
    } catch (e: any) {
        return [{ success: false, message: e?.message, pluginUrl: text }];
    }
}
