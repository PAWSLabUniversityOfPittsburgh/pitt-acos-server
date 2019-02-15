describe('acos-jsparsons-python', function() {

	it('should be displayed on the frontpage', function() {
		return browser
			.url('http://localhost:3000')
			.getText('.container').then(function(text) {
				text.should.contain('jsparsons-python');
			});
	});
  it('ps_hello and ps_simple_function should show up on the frontpage', function() {
    return browser
      .url('http://localhost:3000')
      .getText('.container').then(function(text) {
      	text.should.contain('ps_hello');
      });
  });

	it('ps_hello should be grade correct and incorrect attempts', function() {
    var contentUrl = '/html/jsparsons/jsparsons-python/ps_hello';
		return browser
  			.url(contentUrl)
  			.isVisible('#ul-sortableTrash').then(function(vis) {
  				vis.should.be.equal(true);
  			})
        .isVisible('#sortable').then(function(vis) {
          vis.should.be.equal(true);
        })
        .moveToObject('#sortablecodeline0', 15,15)
        .buttonDown()
        .moveToObject('#ul-sortable', 35, 5)
        .buttonUp()
        .click('#feedbackLink')
        .alertAccept().then(function(a) {
          a.state.should.be.equal('success');
        })
        .getAttribute('#ul-sortable', 'class').then(function(classes) {
          classes.should.contain('incorrect');
        })
        .moveToObject('#sortablecodeline1', 15,15)
        .buttonDown()
        .moveToObject('#ul-sortable', 15, 25)
        .buttonUp()
        .click('#feedbackLink')
        .getAttribute('#ul-sortable', 'class').then(function(classes) {
          classes.should.contain('correct');
          classes.should.not.contain('incorrect');
        });	
    });


    it('ps_simple_function should be grade correct and incorrect attempts', function() {
      var contentUrl = '/html/jsparsons/jsparsons-python/ps_simple_function';
      return browser
          .url(contentUrl)
          .isVisible('#ul-sortableTrash').then(function(vis) {
            vis.should.be.equal(true);
          })
          .isVisible('#sortable').then(function(vis) {
            vis.should.be.equal(true);
          })
          .moveToObject('#sortablecodeline0', 15,15)
          .buttonDown()
          .moveToObject('#ul-sortable', 35, 5)
          .buttonUp()
          .click('#feedbackLink')
          .alertAccept().then(function(a) {
            a.state.should.be.equal('success');
          })
          .moveToObject('#sortablecodeline1', 15,15)
          .buttonDown()
          .moveToObject('#ul-sortable', 75, 35)
          .buttonUp()
          .click('#feedbackLink')
          .alertAccept()
          .getAttribute('#ul-sortable', 'class').then(function(classes) {
            classes.should.contain('incorrect');
          })
          .moveToObject('#sortablecodeline2', 15,15)
          .buttonDown()
          .moveToObject('#ul-sortable', 25, 55)
          .buttonUp()
          .click('#feedbackLink')
          .getAttribute('#ul-sortable', 'class').then(function(classes) {
            classes.should.contain('correct');
            classes.should.not.contain('incorrect');
          });
      });

    
    it('ps_simple_params should be grade correct and incorrect attempts', function() {
      var contentUrl = '/html/jsparsons/jsparsons-python/ps_simple_params';
      return browser
          .url(contentUrl)
          .isVisible('#ul-sortableTrash').then(function(vis) {
            vis.should.be.equal(true);
          })
          .isVisible('#sortable').then(function(vis) {
            vis.should.be.equal(true);
          })
          .moveToObject('#sortablecodeline0', 15,15)
          .buttonDown()
          .moveToObject('#ul-sortable', 35, 5)
          .buttonUp()
          .click('#feedbackLink')
          .alertAccept().then(function(a) {
            a.state.should.be.equal('success');
          })
          .moveToObject('#sortablecodeline1', 15,15)
          .buttonDown()
          .moveToObject('#ul-sortable', 75, 35)
          .buttonUp()
          .click('#feedbackLink')
          .alertAccept()
          .getAttribute('#ul-sortable', 'class').then(function(classes) {
            classes.should.contain('incorrect');
          })
          .moveToObject('#sortablecodeline2', 15,15)
          .buttonDown()
          .moveToObject('#ul-sortable', 25, 55)
          .buttonUp()
          .click('#feedbackLink')
          .getAttribute('#ul-sortable', 'class').then(function(classes) {
            classes.should.contain('correct');
            classes.should.not.contain('incorrect');
          });
      });    
});