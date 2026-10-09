import ChannelHeader from "@/components/channel-header";
import MarginSimulator from "@/components/margin-simulator-loader";

export default function MarginSimulatorPage() {
  return (
    <>
      <ChannelHeader
        icon="💹"
        title="마진 시뮬레이터"
        description="페네핏 쇼피SG 프로모션 상황·바우처·AMS별 마진 계산"
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <MarginSimulator />
      </div>
    </>
  );
}
