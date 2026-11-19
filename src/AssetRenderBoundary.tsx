import {Component,ReactNode} from 'react';
import {t} from './i18n';
export default class AssetRenderBoundary extends Component<{revision:number;onReload:()=>Promise<any>;children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidUpdate(previous:any){if(this.state.failed&&previous.revision!==this.props.revision)this.setState({failed:false});}
 render(){return this.state.failed?<div className="notice" role="alert">{t('资产数据无法显示。')}<button onClick={()=>this.props.onReload().then(()=>this.setState({failed:false})).catch(()=>{})}>{t('重新载入磁盘版本')}</button></div>:this.props.children;}
}
