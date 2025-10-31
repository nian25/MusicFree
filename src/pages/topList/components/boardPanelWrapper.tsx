import React, { useEffect, useMemo, useState } from "react";
import useGetTopList from "../hooks/useGetTopList";
import { useAtomValue } from "jotai";
import { pluginsTopListAtom } from "../store/atoms";
import BoardPanel from "./boardPanel";
import { RequestStateCode } from "@/constants/commonConst";

interface IBoardPanelProps {
    hash: string;
}
export default function BoardPanelWrapper(props: IBoardPanelProps) {
    const { hash } = props ?? {};
    const topLists = useAtomValue(pluginsTopListAtom);
    const getTopList = useGetTopList();
    const topListData = useMemo(() => topLists[hash], [topLists]);
    const [forceRefresh, setForceRefresh] = useState(false);

    useEffect(() => {
        getTopList(hash, forceRefresh);
        if (forceRefresh) {
            setForceRefresh(false);
        }
    }, [forceRefresh, hash, topListData?.state]);

    return <BoardPanel topListData={topListData} hash={hash} setForceRefresh={setForceRefresh} />;
}