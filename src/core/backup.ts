/** 备份与恢复 */
/** 歌单、插件 */
import { compare } from "compare-versions";
import PluginManager from "./pluginManager";
import MusicSheet from "@/core/musicSheet";
import { ResumeMode } from "@/constants/commonConst.ts";

/**
 * 结果：一份大的json文件
 * {
 *     musicSheets: [],
 *     plugins: [],
 * }
 */

interface IBackJson {
    musicSheets: IMusic.IMusicSheetItem[];
    plugins: Array<{ srcUrl: string; version: string }>;
}

function backup() {
    const musicSheets = MusicSheet.backupSheets();
    const plugins = PluginManager.getEnabledPlugins();
    const normalizedPlugins = plugins.map(_ => ({
        srcUrl: _.instance.srcUrl,
        version: _.instance.version,
    }));

    return JSON.stringify({
        musicSheets: musicSheets,
        plugins: normalizedPlugins,
    });
}

async function resume(
    raw: string | Object,
    resumeMode: ResumeMode = ResumeMode.Append,
) {
    let obj: IBackJson;
    if (typeof raw === "string") {
        obj = JSON.parse(raw);
    } else {
        obj = raw as IBackJson;
    }

    const { plugins, musicSheets } = obj ?? {};
    /** 恢复插件 */
    const validPlugins = PluginManager.getEnabledPlugins();
    const resumePlugins: Array<Promise<any>> = [];
    
    // 并行安装改成顺序安装插件，确保状态正确更新
    if (plugins?.length) {
        for (const plugin of plugins) {
            // 校验是否安装过: 同源且本地版本更高就忽略掉
            if (
                validPlugins.find(
                    p =>
                        p.instance.srcUrl === plugin.srcUrl &&
                        compare(
                            p.instance.version ?? "0.0.0",
                            plugin.version ?? "0.0.1",
                            ">=",
                        ),
                )
            ) {
                continue;
            }
            
            // 顺序安装插件
            try {
                await PluginManager.installPluginFromUrl(plugin.srcUrl);
            } catch (e) {
                console.error("插件恢复失败:", plugin.srcUrl, e);
            }
        }
    }

    /** 恢复歌单 */
    const resumeMusicSheets = MusicSheet.resumeSheets(musicSheets, resumeMode);

    // 等待歌单恢复完成
    await resumeMusicSheets;
    
    // 触发插件列表更新事件，确保UI正确刷新
    // 直接返回，插件管理器会在installPluginFromUrl中触发更新事件
    return Promise.resolve();
}

const Backup = {
    backup,
    resume,
};
export default Backup;
