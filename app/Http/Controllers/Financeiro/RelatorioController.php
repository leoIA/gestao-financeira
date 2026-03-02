<?php namespace App\Http\Controllers\Financeiro;


use Illuminate\Support\Facades\DB;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Request;
use Session;
use App\Model\Financeiro\Lancamento;
use App\Model\Financeiro\Conta;
use App\Model\Financeiro\Programacao;
use App\Model\Financeiro\Pessoa;
use App\Model\Financeiro\PlanoConta;
use App\Model\Financeiro\CentroCusto;

class RelatorioController extends FinanceiroController {
    
    public function __construct()
    {
        $this->middleware('authFinanceiroMiddleware');
        
    }
    
    public function saldo_contas(){
        
        $hoje = Date('Y-m-d');
        
        $usuario_id = Session::get('login.financeiro.usuario_id');
        
        $contas_listagem = Conta::OrderBy('nome', 'DESC')->get();
        
        $conta_nome = '';
                
        if($_POST):
            
            $periodo_inicio_form = '';
            $periodo_fim = Request::input('dt_fim');
            $periodo_fim_form = Request::input('dt_fim');
            $conta = Request::input('conta');
            
            if(!empty($periodo_fim)):
                $intervalo = "Saldo Até: $periodo_fim";
            endif;
            
            
            if(!empty($conta)):
                
                $conta_detalhe = Conta::find($conta); 
            
                $lancamentos = Lancamento::where('conta_id', '=', $conta);
            
                if(!empty($periodo_fim)):
                    $lancamentos = $lancamentos->where('data_lancamento', '<=', $periodo_fim);
                endif;

                $lancamentos_result = $lancamentos->select(DB::raw('sum(valor_total) as valor_total'))->first();

                $contas_arr[$conta_detalhe->id]['nome'] = $conta_detalhe->nome;  
                $contas_arr[$conta_detalhe->id]['saldo'] = $lancamentos_result->valor_total + $conta_detalhe->valor;
                $contas_saldo = $lancamentos_result->valor_total + $conta_detalhe->valor;
                
                $conta_nome = $conta_detalhe->nome;
            else:
                
                $contas = Conta::OrderBy('nome', 'ASC')->get();
                $contas_arr = array();
                $contas_saldo = 0;

                foreach ($contas as $conta):
                    $contas_arr[$conta->id]['nome'] = $conta->nome;
                    
                    if(!empty($periodo_fim)):
                        $lancamentos = Lancamento::where(['conta_id' => $conta->id])->where('data_lancamento', '<=', $periodo_fim)->select(DB::raw('sum(valor_total) as valor_total'))->first();
                    else:
                        $lancamentos = Lancamento::where(['conta_id' => $conta->id])->select(DB::raw('sum(valor_total) as valor_total'))->first();
                    endif;
                    
                    $contas_arr[$conta->id]['saldo'] = $lancamentos->valor_total + $conta->valor;
                    $contas_saldo = $contas_saldo + $lancamentos->valor_total + $conta->valor;
                endforeach;
                
            endif;
            
        else:
            
            $periodo_inicio_form = '';
            $periodo_fim_form = '';
            $conta = '';
            
            // SALDO CONTAS E TOTAL
            $contas = Conta::OrderBy('nome', 'ASC')->get();
            $contas_arr = array();
            $contas_saldo = 0;
            $intervalo = "Saldo Até: " . Date('d/m/Y');
            
            foreach ($contas as $conta):
                $contas_arr[$conta->id]['nome'] = $conta->nome;
                $lancamentos = Lancamento::where(['conta_id' => $conta->id])->select(DB::raw('sum(valor_total) as valor_total'))->first();
                $contas_arr[$conta->id]['saldo'] = $lancamentos->valor_total + $conta->valor;
                $contas_saldo = $contas_saldo + $lancamentos->valor_total + $conta->valor;
            endforeach;
            
        endif;
        

        return view('financeiro/relatorio/saldo-contas')
                ->with('contas', $contas_arr)
                ->with('contas_saldo', $contas_saldo)
                ->with('contas_listagem', $contas_listagem)
                ->with('periodo_inicio_form', $periodo_inicio_form)
                ->with('periodo_fim_form', $periodo_fim_form)
                ->with('conta', $conta)
                ->with('conta_nome', $conta_nome)
                ->with('intervalo', $intervalo);
        
    }
    
    public function demonstrativo(){
        
        return view('financeiro/relatorio/demonstrativo');
        
    }
    
    public function extrato_contas(){
        
        $hoje = Date('Y-m-d');
        
        $usuario_id = Session::get('login.financeiro.usuario_id');
        
        $contas_listagem = Conta::OrderBy('nome', 'DESC')->get();
        
        $conta_nome = '';
        
        if($_POST):
            
            $periodo_fim = Request::input('dt_fim');
            $periodo_inicio = Request::input('dt_inicio');
            
            if(!empty($periodo_inicio)):
                $intervalo = "Saldo Até: $periodo_inicio";
                $periodo_inicio_form = $periodo_inicio;
            endif;
            
            if(!empty($periodo_fim)):
                $periodo_fim_form = $periodo_fim;
            endif;
            
            $conta = Request::input('conta');
            
            if(!empty($conta)):
                
                $conta_detalhe = Conta::find($conta);
            
                $lancamentos = Lancamento::where('conta_id', '=', $conta);
            
                if(!empty($periodo_fim)):
                    $lancamentos = $lancamentos->whereBetween('data_lancamento', [$periodo_inicio, $periodo_fim]);
                endif;
                
                $lancamentos_result = $lancamentos->with('planoConta')->with('pessoa')->orderBy('data_lancamento', 'ASC')->get();

                $lancamentos_inicial = Lancamento::select(DB::raw('sum(valor_total) as saldo'))->where('conta_id', '=', $conta)->where('data_lancamento', '<', $periodo_inicio)->get();
                
                $contas_arr[$conta_detalhe->nome][] = $lancamentos_result;
                $contas_arr[$conta_detalhe->nome][1] = $lancamentos_inicial[0]['saldo'];
                
            else:
                
                $contas = Conta::OrderBy('nome', 'ASC')->get();
                $contas_arr = array();
                $contas_saldo = 0;

                foreach ($contas as $conta):
                    $lancamentos = Lancamento::where(['conta_id' => $conta->id, 'inicial' => 0])->whereBetween('data_lancamento', [$periodo_inicio, $periodo_fim])->with('planoConta')->with('pessoa')->orderBy('data_lancamento', 'ASC')->get();
                    $lancamentos_inicial = Lancamento::select(DB::raw('sum(valor_total) as saldo'))->where('conta_id', '=', $conta->id)->where('data_lancamento', '<', $periodo_inicio)->get();
                    $contas_arr[$conta->nome][] = $lancamentos;
                    $contas_arr[$conta->nome][1] = $lancamentos_inicial[0]['saldo'];
                endforeach;
                
            endif;
            
        else:
            
            $periodo_fim = Date('Y-m-d');
            $periodo_inicio = date('Y-m-d', strtotime("-6 months",strtotime($periodo_fim)));
            
            if(!empty($periodo_inicio)):
                $periodo_inicio_arr = explode("-", $periodo_inicio);
                $periodo_inicio_form = $periodo_inicio_arr[2].'/'.$periodo_inicio_arr[1].'/'.$periodo_inicio_arr[0];
            endif;
            
            if(!empty($periodo_fim)):
                $periodo_fim_arr = explode("-", $periodo_fim);
                $periodo_fim_form = $periodo_fim_arr[2].'/'.$periodo_fim_arr[1].'/'.$periodo_fim_arr[0];
            endif;
                
            $conta = '';
            
            // SALDO CONTAS E TOTAL
            $contas = Conta::OrderBy('nome', 'ASC')->get();
            $contas_arr = array();
            $contas_saldo = 0;
            $intervalo = "Período: de: " . $periodo_inicio_form . ' até: ' . $periodo_fim_form;
            
            foreach ($contas as $conta):
                $lancamentos = Lancamento::where(['conta_id' => $conta->id, 'inicial' => 0])->whereBetween('data_lancamento', [$periodo_inicio, $periodo_fim])->with('planoConta')->with('pessoa')->orderBy('data_lancamento', 'ASC')->get();
                $lancamentos_inicial = Lancamento::select(DB::raw('sum(valor_total) as saldo'))->where('conta_id', '=', $conta->id)->where('data_lancamento', '<', $periodo_inicio)->get();

                $contas_arr[$conta->nome][] = $lancamentos;
                $contas_arr[$conta->nome][1] = $lancamentos_inicial[0]['saldo'];
            endforeach;
            
        endif;
        

        return view('financeiro/relatorio/extrato-contas')
                ->with('contas', $contas_arr)
                ->with('contas_listagem', $contas_listagem)
                ->with('periodo_inicio_form', $periodo_inicio_form)
                ->with('periodo_fim_form', $periodo_fim_form)
                ->with('conta', $conta)
                ->with('conta_nome', $conta_nome)
                ->with('intervalo', $intervalo);
        
    }
    
    
    public function fluxo_caixa(){
        
        $hoje = Date('Y-m-d');
        
        $usuario_id = Session::get('login.financeiro.usuario_id');
        
        $contas_listagem = Conta::OrderBy('nome', 'DESC')->get();
        
        $conta_nome = '';
        
        if($_POST):
            
            $periodo_fim = Request::input('dt_fim');
            $periodo_inicio = Request::input('dt_inicio');
            
            if(!empty($periodo_inicio)):
                $intervalo = "Período: de: " . $periodo_inicio . ' até: ' . $periodo_fim;
                $periodo_inicio_form = $periodo_inicio;
            endif;
            
            if(!empty($periodo_fim)):
                $periodo_fim_form = $periodo_fim;
            endif;
            
            $conta = Request::input('conta');
            
            if(!empty($conta)):
                
                $conta_detalhe = Conta::find($conta);
            
                $programadas = Programacao::where('conta_id', '=', $conta);
            
                if(!empty($periodo_fim)):
                    $programadas = $programadas->whereBetween('data_vencimento', [$periodo_inicio, $periodo_fim]);
                endif;
                
                $programadas = $programadas->whereHas('pessoa', function ($query) {
                    return $query->where('ativo', '=', 1);
                });

                $programadas_result = $programadas->with('planoConta')->with('pessoa')->with('conta')->get();

                $contas_arr = $programadas_result;
                
            else:
                
                $programadas = Programacao::whereBetween('data_vencimento', [$periodo_inicio, $periodo_fim]);
                $programadas = $programadas->whereHas('pessoa', function ($query) {
                    return $query->where('ativo', '=', 1);
                });
                $programadas = $programadas->with('planoConta')->with('conta')->with('pessoa')->orderBy('data_vencimento', 'ASC')->get();
                $contas_arr = $programadas;
                
            endif;
            
            $lancamentos = Lancamento::select(DB::raw('sum(valor_total) as valor_total'))->first();
            $saldo_atual = $lancamentos->valor_total;
            
        else:
            
            $periodo_inicio = Date('Y-m-d');
            $periodo_fim = date('Y-m-d', strtotime("+7 days",strtotime($periodo_inicio)));
            
            if(!empty($periodo_inicio)):
                $periodo_inicio_arr = explode("-", $periodo_inicio);
                $periodo_inicio_form = $periodo_inicio_arr[2].'/'.$periodo_inicio_arr[1].'/'.$periodo_inicio_arr[0];
            endif;
            
            if(!empty($periodo_fim)):
                $periodo_fim_arr = explode("-", $periodo_fim);
                $periodo_fim_form = $periodo_fim_arr[2].'/'.$periodo_fim_arr[1].'/'.$periodo_fim_arr[0];
            endif;
                
            $conta = '';
            
            // SALDO CONTAS E TOTAL
            $contas_arr = array();
            $contas_saldo = 0;
            $intervalo = "Período: de: " . $periodo_inicio_form . ' até: ' . $periodo_fim_form;
            
            $programadas = Programacao::whereBetween('data_vencimento', [$periodo_inicio, $periodo_fim]);
            $programadas = $programadas->whereHas('pessoa', function ($query) {
                    return $query->where('ativo', '=', 1);
                });
            $programadas = $programadas->with('planoConta')->with('conta')->with('pessoa')->orderBy('data_vencimento', 'ASC')->get();
        
            $contas_arr = $programadas;
            
            $lancamentos = Lancamento::select(DB::raw('sum(valor_total) as valor_total'))->first();
            $saldo_atual = $lancamentos->valor_total;
            
        endif;
        

        return view('financeiro/relatorio/fluxo-caixa')
                ->with('contas', $contas_arr)
                ->with('contas_listagem', $contas_listagem)
                ->with('periodo_inicio_form', $periodo_inicio_form)
                ->with('periodo_fim_form', $periodo_fim_form)
                ->with('saldo_atual', $saldo_atual)
                ->with('intervalo', $intervalo);
        
    }
    
    
    public function receitas_despesas(){
        
        $hoje = Date('Y-m-d');
        
        $usuario_id = Session::get('login.financeiro.usuario_id');
        
        $contas_listagem = Conta::OrderBy('nome', 'ASC')->get();
        $pessoas_listagem = Pessoa::OrderBy('nome', 'ASC')->get();
        $plano_contas_listagem = PlanoConta::OrderBy('descricao', 'DESC')->get();
        $centro_custos_listagem = CentroCusto::OrderBy('descricao', 'ASC')->get();
        
        
        $plano_de_contas_receitas = PlanoConta::where('ativo', '=', 1)->where('parent_id', '=', 0)->where('tipo_lancamento', '=', 1)->orderBy('descricao', 'ASC')->get();
        $plano_receitas_array = array();
        foreach($plano_de_contas_receitas as $item):
            $plano_receitas_array[] = array('descricao' => $item->descricao, 'pai' => 1, 'id' => $item->id);
            $plano_de_contas_filhos = PlanoConta::where('ativo', '=', 1)->where('parent_id', '=', $item->id)->orderBy('descricao', 'ASC')->get();
            foreach($plano_de_contas_filhos as $item_filho):
                $plano_receitas_array[] = array('descricao' => $item_filho->descricao, 'pai' => 0, 'id' => $item_filho->id);
            endforeach;
        endforeach;
        
        $plano_de_contas_despesas = PlanoConta::where('ativo', '=', 1)->where('parent_id', '=', 0)->where('tipo_lancamento', '=', 2)->orderBy('descricao', 'ASC')->get();
        $plano_despesas_array = array();
        foreach($plano_de_contas_despesas as $item):
            $plano_despesas_array[] = array('descricao' => $item->descricao, 'pai' => 1, 'id' => $item->id);
            $plano_de_contas_filhos = PlanoConta::where('ativo', '=', 1)->where('parent_id', '=', $item->id)->orderBy('descricao', 'ASC')->get();
            foreach($plano_de_contas_filhos as $item_filho):
                $plano_despesas_array[] = array('descricao' => $item_filho->descricao, 'pai' => 0, 'id' => $item_filho->id);
            endforeach;
        endforeach;
        

        $centro_de_custo = CentroCusto::where('ativo', '=', 1)->where('parent_id', '=', 0)->orderBy('descricao', 'ASC')->get();
        $centro_array = array();
        foreach($centro_de_custo as $item):
            $centro_array[] = array('descricao' => $item->descricao, 'pai' => 1, 'id' => $item->id);
            $centro_de_custo_filhos = PlanoConta::where('ativo', '=', 1)->where('parent_id', '=', $item->id)->orderBy('descricao', 'ASC')->get();
            foreach($centro_de_custo_filhos as $item_filho):
                $centro_array[] = array('descricao' => $item_filho->descricao, 'pai' => 0, 'id' => $item_filho->id);
            endforeach;
        endforeach;
        
        
        $conta_nome = '';
        $pessoa_nome = '';
        $plano_conta_nome = '';
        $centro_custo_nome = '';
        
        if($_POST):
            
            $periodo_fim = Request::input('dt_fim');
            $periodo_inicio = Request::input('dt_inicio');
            
            if(!empty($periodo_inicio)):
                $intervalo = "Período: de: " . $periodo_inicio . ' até: ' . $periodo_fim;
                $periodo_inicio_form = $periodo_inicio;
            endif;
            
            if(!empty($periodo_fim)):
                $periodo_fim_form = $periodo_fim;
            endif;
            
            $conta = Request::input('conta');
            $cliente = Request::input('cliente');
            $plano_conta = Request::input('plano_conta');
            $centro_custo = Request::input('centro_custo');
            
            
            $lancamentos = Lancamento::where('id', '>', 0);
            $lancamentos = $lancamentos->whereBetween('data_lancamento', [$periodo_inicio, $periodo_fim]);
            
            
            if(!empty($conta)):
                $lancamentos = $lancamentos->where('conta_id', '=', $conta);
                $conta_detalhe = Conta::find($conta);
                $conta_nome = $conta_detalhe->nome;
            endif;
            
            if(!empty($cliente)):
                $lancamentos = $lancamentos->where('pessoa_id', '=', $cliente);
                $pessoa_detalhe = Pessoa::find($cliente);
                $pessoa_nome = $pessoa_detalhe->nome;
            endif;
            
            if(!empty($plano_conta)):
                $lancamentos = $lancamentos->where('plano_conta_id', '=', $plano_conta);
                $plano_conta_detalhe = PlanoConta::find($plano_conta);
                $plano_conta_nome = $plano_conta_detalhe->descricao;
            endif;
            
            if(!empty($centro_custo)):
                $lancamentos = $lancamentos->where('centro_custo_id', '=', $centro_custo);
                $centro_custo_detalhe = CentroCusto::find($centro_custo);
                $centro_custo_nome = $centro_custo_detalhe->descricao;
            endif;

            
            $lancamentos_result = $lancamentos->with('planoConta')->with('pessoa')->with('conta')->orderBy('data_lancamento', 'ASC')->get();
            $contas_arr = $lancamentos_result;
            
            
        else:
            
            $contas_arr = array();
            $periodo_inicio_form = '';
            $periodo_fim_form = '';
            $saldo_atual = '';
            $intervalo = '';
            
        endif;
        

        return view('financeiro/relatorio/receita-despesa-pessoa')
                ->with('contas', $contas_arr)
                ->with('contas_listagem', $contas_listagem)
                ->with('pessoas_listagem', $pessoas_listagem)
                ->with('plano_contas_listagem', $plano_contas_listagem)
                ->with('centro_custos_listagem', $centro_custos_listagem)
                ->with('periodo_inicio_form', $periodo_inicio_form)
                ->with('periodo_fim_form', $periodo_fim_form)
                ->with('conta_nome', $conta_nome)
                ->with('pessoa_nome', $pessoa_nome)
                ->with('plano_conta_nome', $plano_conta_nome)
                ->with('centro_custo_nome', $centro_custo_nome)
                ->with('plano_de_contas_receitas', $plano_receitas_array)
                ->with('plano_de_contas_despesas', $plano_despesas_array)
                ->with('centro_de_custo', $centro_array)
                ->with('intervalo', $intervalo);
        
    }
    
}