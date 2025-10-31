import axios from "axios";
import { compare } from "compare-versions";
import DeviceInfo from "react-native-device-info";

const updateList = [
    "https://gitee.com/nian25/music-free/raw/master/version.json",
];

interface IUpdateInfo {
    needUpdate: boolean;
    data: {
        version: string;
        changeLog: string[];
        download: string[];
    };
}

export default async function checkUpdate(): Promise<IUpdateInfo | undefined> {
    const currentVersion = DeviceInfo.getVersion();
    // const currentVersion = '0.6.1';
    console.log("当前版本：",DeviceInfo.getVersion());
    
    for (let i = 0; i < updateList.length; ++i) {
        try {
            const rawInfo = (await axios.get(updateList[i])).data;
            console.log("最新版本：",rawInfo.version);
            if (compare(rawInfo.version, currentVersion, ">")) {
                return {
                    needUpdate: true,
                    data: rawInfo,
                };
            }
        } catch {}
    }
}
