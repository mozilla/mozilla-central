<h1><?=__('login')?></h1>
<?=$form->create(array('action' => 'login'))."\n"?>
  <?=$form->input('email', array('label' => __('email', true)))."\n"?>
  <?=$form->input('password', array('label' => __('password', true)))."\n"?>
  <?=$form->submit(__('login', true))."\n"?>
</form>
<p>
  <a href="<?php echo $html->url('/users/register'); ?>"><?=__('create_account')?></a> | <a href="<?php echo $html->url('/users/recover/password'); ?>"><?=__('forgot_password_prompt')?></a>
</p>
