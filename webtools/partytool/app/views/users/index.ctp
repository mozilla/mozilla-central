<h1><?=__('profile_title')?></h1>
<h2><?=__('profile_attending')?></h2>
<p>
<?php
  $num_parties = count($parties);
  if ($num_parties == 0)
    echo sprintf(__('profile_no_attended_parties', true), $html->url('/parties/view/all'));
  
  else {
    $c = $num_parties - 1;
    $i = 0;
    foreach ($parties as $party) {
      echo '<a href="'.$html->url('/parties/view/'.$party['parties']['id']).'">'.$party['parties']['name'].'</a>';
      echo ($i < $c) ? ', ' : '';
      $i++;
    }
  }
?>
</p>
<h2><?=__('profile_hosting')?></h2>
<p>
<?php
  $num_parties = count($hparties);
  if (empty($hparties))
    echo sprintf(__('profile_no_hosted_parties', true), $html->url('/parties/add'));
  
  else {
    $c = $num_parties - 1;
    $i = 0;
    foreach ($hparties as $party) {
      echo '<a href="'.$html->url('/parties/view/'.$party['parties']['id']).'">'.$party['parties']['name'].'</a>';
      echo ($i < $c) ? ', ' : '';
      $i++;
    }
  }
?>
<h2><?=__('profile_invited')?></h2>
<p>
<?php
  $num_parties = count($iparties);
  if (empty($iparties))
    __('profile_no_invites');
  
  else {
    $c = $num_parties - 1;
    $i = 0;
    foreach ($iparties as $party) {
      echo '<a href="'.$html->url('/parties/view/'.$party['parties']['id']).'">'.$party['parties']['name'].'</a>';
      echo ($i < $c) ? ', ' : '';
      $i++;
    }
  }
?>
</p>
<h2><?=__('profile_account_opts')?></h2>
<p>
  <a href="<?php echo $html->url('/users/edit'); ?>"><?=__('profile_edit')?></a>
  <br/>
  <a href="<?php echo $html->url('/users/logout'); ?>"><?=__('logout')?></a>
</p>
