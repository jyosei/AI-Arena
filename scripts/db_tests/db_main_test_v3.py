import time, uuid
from django.apps import apps
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model

print('Starting DB write capability test v3 (savepoint rollback)')
ts = int(time.time())
uniq = lambda base: f"{base}-{ts}-{uuid.uuid4().hex[:6]}"
User = get_user_model()

# ensure two distinct users for FK relationships
u1, _ = User.objects.get_or_create(username=f'db_test_u1_{ts}', defaults={'email': f'db{ts}a@example.com'})
u2, _ = User.objects.get_or_create(username=f'db_test_u2_{ts}', defaults={'email': f'db{ts}b@example.com'})
print('users:', u1.pk, u2.pk)

apps_to_test = ['users', 'models_manager', 'forum']
summary = {'success': [], 'skipped': [], 'failed': []}

for app_label in apps_to_test:
    try:
        app_config = apps.get_app_config(app_label)
    except LookupError:
        print('App not found:', app_label)
        summary['skipped'].append((app_label, 'app-not-found'))
        continue
    models = list(app_config.get_models())
    print('\n--- Testing app:', app_label, 'models count=', len(models))
    for model in models:
        model_label = f"{app_label}.{model.__name__}"
        print('\nTesting', model_label)
        sid = transaction.savepoint()
        try:
            # special-case handling
            if app_label == 'users' and model.__name__ == 'UserFollow':
                try:
                    UF = apps.get_model('users', 'UserFollow')
                    inst = UF.objects.create(follower=u1, following=u2)
                    print('  created UserFollow id=', inst.pk)
                    summary['success'].append(model_label)
                except Exception as e:
                    print('  failed UserFollow:', repr(e))
                    summary['failed'].append((model_label, repr(e)))
                finally:
                    transaction.savepoint_rollback(sid)
                continue

            if app_label == 'models_manager' and model.__name__ == 'BenchmarkScore':
                try:
                    AIModel = apps.get_model('models_manager', 'AIModel')
                    am = AIModel.objects.create(name=uniq('aim'), display_name=uniq('aim'))
                    bs = model.objects.create(model=am, total_score=0.0, scores={})
                    print('  created BenchmarkScore id=', bs.pk, 'ai=', am.pk)
                    summary['success'].append(model_label)
                except Exception as e:
                    print('  failed BenchmarkScore:', repr(e))
                    summary['failed'].append((model_label, repr(e)))
                finally:
                    transaction.savepoint_rollback(sid)
                continue

            if app_label == 'forum' and model.__name__ in ('ForumPostReaction', 'ForumCommentReaction'):
                try:
                    from forum.models import ForumPost, ForumComment
                    target_user = User.objects.first()
                    if model.__name__ == 'ForumPostReaction':
                        target = ForumPost.objects.first()
                        if not target:
                            raise RuntimeError('no ForumPost available')
                        inst = model.objects.create(post=target, user=target_user, reaction_type='like')
                    else:
                        target = ForumComment.objects.first()
                        if not target:
                            raise RuntimeError('no ForumComment available')
                        inst = model.objects.create(comment=target, user=target_user, reaction_type='like')
                    print('  created reaction id=', inst.pk)
                    summary['success'].append(model_label)
                except Exception as e:
                    print('  failed Reaction:', repr(e))
                    summary['failed'].append((model_label, repr(e)))
                finally:
                    transaction.savepoint_rollback(sid)
                continue

            # generic creation attempt: build kwargs only from actual field names
            kwargs = {}
            skip = False
            for field in model._meta.fields:
                if getattr(field, 'auto_created', False) or field.primary_key:
                    continue
                if field.null or field.has_default():
                    continue
                fname = field.name
                if field.many_to_one and field.related_model is not None:
                    rel = field.related_model
                    # prefer existing instances
                    try:
                        rel_obj = rel.objects.order_by('pk').first()
                        if rel_obj is None:
                            print('  skipping, no rows for FK', fname, rel)
                            skip = True
                            break
                        kwargs[fname] = rel_obj
                    except Exception as e:
                        print('  error inspecting rel', fname, repr(e))
                        skip = True
                        break
                else:
                    # primitive types
                    from django.db import models as dj
                    if isinstance(field, (dj.CharField, dj.TextField, dj.SlugField)):
                        if getattr(field, 'choices', None):
                            try:
                                kwargs[fname] = field.choices[0][0]
                            except Exception:
                                kwargs[fname] = uniq(model.__name__)
                        else:
                            kwargs[fname] = uniq(model.__name__)
                    elif getattr(field, 'choices', None):
                        try:
                            kwargs[fname] = field.choices[0][0]
                        except Exception:
                            kwargs[fname] = None
                    elif isinstance(field, dj.EmailField):
                        kwargs[fname] = uniq('e') + '@example.com'
                    elif isinstance(field, (dj.IntegerField, dj.PositiveIntegerField)):
                        kwargs[fname] = 1
                    elif isinstance(field, dj.FloatField):
                        kwargs[fname] = 0.0
                    elif isinstance(field, dj.BooleanField):
                        kwargs[fname] = False
                    elif isinstance(field, dj.DateTimeField):
                        kwargs[fname] = timezone.now()
                    elif isinstance(field, dj.JSONField):
                        kwargs[fname] = {}
                    elif isinstance(field, dj.DecimalField):
                        kwargs[fname] = '1.0'
                    elif isinstance(field, (dj.FileField, dj.ImageField)):
                        print('  skip file/image field', fname)
                        skip = True
                        break
                    else:
                        kwargs[fname] = None
            if skip:
                transaction.savepoint_rollback(sid)
                summary['skipped'].append((model_label, 'missing-fk-or-filefield'))
                continue

            # attempt create with filtered kwargs
            try:
                allowed = {f.name for f in model._meta.fields if not (getattr(f, 'auto_created', False) or f.primary_key)}
                filtered = {k: v for k, v in kwargs.items() if k in allowed}
                inst = model.objects.create(**filtered)
                print('  created id=', getattr(inst, 'pk', None))
                summary['success'].append(model_label)
            except Exception as e:
                print('  create failed generic:', repr(e))
                summary['failed'].append((model_label, repr(e)))
            finally:
                transaction.savepoint_rollback(sid)
        except Exception as outer:
            print('  unexpected', repr(outer))
            try:
                transaction.savepoint_rollback(sid)
            except Exception:
                pass
            summary['failed'].append((model_label, repr(outer)))

print('\n=== SUMMARY v3 ===')
print('Success:', len(summary['success']))
print('Skipped:', len(summary['skipped']))
print('Failed:', len(summary['failed']))
if summary['failed']:
    print('Failures:')
    for f in summary['failed']:
        print(' -', f)
if summary['skipped']:
    print('Skipped:')
    for s in summary['skipped']:
        print(' -', s)
print('done')
