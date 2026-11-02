import { Component, type ReactNode } from 'react';
export class WorkspaceErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div role="alert" className="space-y-4 p-8"><h1 className="text-xl font-semibold">この画面を表示できませんでした</h1><p>保存先のデータは削除していません。別の画面へ移動するか、表示を再試行してください。</p><button className="rounded border px-4 py-2" onClick={()=>this.setState({failed:false})}>表示を再試行</button></div>:this.props.children;}
}
